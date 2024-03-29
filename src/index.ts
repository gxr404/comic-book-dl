import { logger } from '@/utils'
import { run } from '@/core'
import { scanFolder } from '@/lib/download'
import type { Config, ErrorChapterItem } from '@/core'
import type { ChaptersItem } from '@/lib/parse/base'

interface ChapterErrorMsgItem {
  chapterName: string,
  imgList: string[]
}

export function echoErrorMsg(
  bookName: string,
  chaptersList: ChaptersItem[],
  errorList: ErrorChapterItem[],
  isShowDetails: boolean = false
) {
  const errChaptersMsg: ChapterErrorMsgItem[] = []
  errorList.forEach((item)=>{
    const errChapter = errChaptersMsg.find(msg => {
      return msg.chapterName === item.chapter.name
    })
    if (errChapter && item.imgUrl) {
      errChapter.imgList.push(item.imgUrl)
    } else {
      errChaptersMsg.push({
        chapterName: item.chapter.name,
        imgList: item.imgUrl ? [item.imgUrl] : []
      })
    }
  })

  logger.error(`《${bookName}》本次执行总数${chaptersList.length}话，✕ 失败${errChaptersMsg.length}话`)
  for (const errInfo of errChaptersMsg) {
    logger.error(`  └── ✕ ${errInfo.chapterName}`)
    if (isShowDetails) {
      errInfo.imgList.forEach(imgUrl => {
        logger.error(`   └── ${imgUrl}`)
      })
    }
  }
}

export async function main(config: Config) {
  const bookInfoList = await scanFolder(config.bookPath)
  const existedBookInfo = bookInfoList.find(bookInfo => {
    return bookInfo.rawUrl === config.targetUrl
  })
  if (existedBookInfo) config.targetUrl = existedBookInfo.url
  const {ignoreConsole} = config
  await run(config, {
    parseErr() {
      if (ignoreConsole) return
      logger.error('× 请输入正确的url... o(╥﹏╥)o')
    },
    start(bookName) {
      if (ignoreConsole) return
      logger.info(`开始下载 《${bookName}》`)
    },
    downloadInterrupted() {
      if (ignoreConsole) return
      logger.info('根据上次数据继续断点下载')
    },
    error(...args) {
      if (ignoreConsole) return
      echoErrorMsg(...args, true)
      logger.error('o(╥﹏╥)o 由于网络波动或链接失效以上下载失败，可重新执行命令重试(PS:不会影响已下载成功的数据)')
    },
    success(bookName, bookDistPath) {
      if (ignoreConsole) return
      logger.info(`√ 已完成: ${bookDistPath}`)
      logger.info('(つ•̀ω•́)つ 欢迎star: https://github.com/gxr404/comic-book-dl')
    }
  })
  process.exit(0)
}
