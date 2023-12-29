import {resolve} from 'node:path'
import { confirm, checkbox } from '@inquirer/prompts'
import { run } from './core'
import { echoErrorMsg } from './index'
import { logger, notEmpty } from './utils'
import { scanFolder } from './lib/download'
import { BookInfo } from './lib/parse'

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
      ]
    })
    console.log(answer)
    bookInfoList = bookInfoList.filter(bookInfo => answer.includes(bookInfo.url))
  }

  for (const bookInfo of bookInfoList) {
    await updateRun(bookInfo, bookDistPath)
  }
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
        logger.info(`└── √ 已更新: ${chapters.rawName}`)
      })
    }
  })
}


// parseErr() {
//   logger.error('× 请输入正确的url... o(╥﹏╥)o')
// },
// start(bookName) {
//   logger.info(`开始下载 《${bookName}》`)
// },
// downloadInterrupted() {
//   logger.info('根据上次数据继续断点下载')
// },
// error: echoErrorMsg,
// success(bookDistPath) {
//   logger.info(`√ 已完成: ${bookDistPath}`)
// }
// })