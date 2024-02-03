import {resolve} from 'node:path'
import { confirm, checkbox } from '@inquirer/prompts'
import { UserConfig, run } from '@/core'
import { logger, notEmpty } from '@/utils'
import { readConfig, scanFolder } from '@/lib/download'
import {echoErrorMsg} from '@/index'
import type { BookInfo } from '@/lib/parse/base'

interface Config {
  bookPath: string,
}

export async function update(config: Config) {
  const bookDistPath = resolve(String(config.bookPath))
  let bookInfoList = await scanFolder(bookDistPath)
  const userConfig = await readConfig(bookDistPath)

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
      pageSize: 20,
      required: true,
      loop: false
    })
    if (answer.length === 0) {
      logger.error('× 未选中任何漫画更新')
      return
    }
    bookInfoList = bookInfoList.filter(bookInfo => answer.includes(bookInfo.url))
  }

  if (userConfig.ignore) {
    const ignoreBook: string[] = []
    logger.warn('已读取用户配置: ')
    userConfig.ignore.forEach(item => {
      // 只存在漫画名 不存在章节 则代表 整本漫画 忽略
      if (!item.chapter) {
        ignoreBook.push(item.name)
        logger.warn(`└── 《${item.name}》 忽略更新整本漫画`)
      } else {
        logger.warn(`└── 《${item.name}》 忽略更新部分章节`)
        item.chapter.forEach((chapterName) => {
          logger.warn(`    └── ${chapterName}`)
        })
      }
    })
    bookInfoList = bookInfoList.filter(bookInfo => !ignoreBook.includes(bookInfo.name))
  }

  for (const bookInfo of bookInfoList) {
    await updateRun(bookInfo, bookDistPath, userConfig)
  }

  logger.info('(つ•̀ω•́)つ 欢迎star: https://github.com/gxr404/comic-book-dl')
}

async function updateRun(bookInfo: BookInfo, bookDistPath: string, userConfig: UserConfig ) {
  return run({
    bookPath: bookDistPath,
    targetUrl: bookInfo.url,
    userConfig
  }, {
    parseErr() {
      logger.error(`《${bookInfo.name}》解析失败`)
      logger.error(`  └── × 请查看 ${bookInfo.url} 是否正常访问`)
    },
    start(bookName) {
      logger.info(`开始更新 《${bookName}》`)
    },
    error: (...args) => {
      echoErrorMsg(...args)
    },
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
