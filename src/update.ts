import {resolve} from 'node:path'
import { confirm, checkbox } from '@inquirer/prompts'
import { ErrorChapterItem, run } from '@/core'
import { logger, notEmpty } from '@/utils'
import { scanFolder } from '@/lib/download'
import type { BookInfo, ChaptersItem } from '@/lib/parse/base'

interface Config {
  bookPath: string,
}

export async function update(config: Config) {
  const bookDistPath = resolve(String(config.bookPath))
  let bookInfoList = await scanFolder(bookDistPath)
  if (bookInfoList.length === 0) {
    logger.info(`无法更新, 目录(${bookDistPath})不存在漫画`)
    return
  }
  const isUpdateAll = await confirm({
    message: '是否全部更新？'
  })
  if (!isUpdateAll) {
    const bookChoices = bookInfoList.map(bookInfo => {
      if (!bookInfo) return null
      return {
        name: bookInfo.name,
        value: bookInfo.url
      }
    }).filter(notEmpty)
    const answer = await checkbox({
      message: '已存在以下漫画，选择想更新的漫画',
      choices: [
        ...bookChoices
      ],
      pageSize: 99,
      required: true,
      loop: false
    })
    if (answer.length === 0) {
      logger.error('× 未选中任何漫画更新')
      return
    }
    bookInfoList = bookInfoList.filter(bookInfo => answer.includes(bookInfo.url))
  }

  for (const bookInfo of bookInfoList) {
    await updateRun(bookInfo, bookDistPath)
  }

  logger.info('(つ•̀ω•́)つ 欢迎star: https://github.com/gxr404/comic-book-dl')
}

async function updateRun(bookInfo: BookInfo, bookDistPath: string) {
  return run({
    bookPath: bookDistPath,
    targetUrl: bookInfo.url
  }, {
    start(bookName) {
      logger.info(`开始更新 《${bookName}》`)
    },
    error: echoErrorMsg,
    success(bookName, bookDistPath, chaptersList) {
      if (!chaptersList) {
        logger.info(`《${bookName}》已是最新, 无需更新`)
        return
      }
      chaptersList.forEach((chapters) => {
        logger.info(`  └── √ 已更新: ${chapters.rawName}`)
      })
    }
  })
}

interface ChapterErrorMsgItem {
  chapterName: string,
  imgList: string[]
}

function echoErrorMsg(
  bookName: string,
  chaptersList: ChaptersItem[],
  errorList: ErrorChapterItem[]
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
  }
  logger.error('o(╥﹏╥)o 由于网络波动或链接失效以上下载失败，可重新执行命令重试(PS:不会影响已下载成功的数据)')
}
