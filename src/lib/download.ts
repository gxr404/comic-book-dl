import { writeFileSync } from 'node:fs'
import { readdir, stat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import pLimit from 'p-limit'
import { notEmpty } from '@/utils'
import { Base, BookInfo } from '@/lib/parse/base'

export async function writeBookInfoFile(bookInfo: BookInfo, bookDistPath: string, parseInstance: Base) {
  const coverPicPath = await parseInstance.saveImg(bookDistPath, bookInfo.coverUrl, 'cover')
  bookInfo.coverPath = coverPicPath
  writeFileSync(`${bookDistPath}/bookInfo.json`, JSON.stringify(bookInfo, null, 2))
}

export async function scanFolder(distPath: string) {
  const LIMIT_MAX = 6
  let folderList: string[]
  try {
    folderList = await readdir(distPath)
  } catch (e) {
    folderList = []
  }
  const limit = pLimit(LIMIT_MAX)
  const promiseList = folderList.map((folder) => {
    return limit(async () => {
      const curBookPath = join(distPath, folder)
      const itemStat = await stat(curBookPath)
      if (!itemStat.isDirectory()) return null
      try {
        const bookInfoStr = await readFile(`${curBookPath}/bookInfo.json`, {encoding: 'utf-8'})
        const bookInfo: BookInfo = JSON.parse(bookInfoStr)
        return bookInfo
      } catch (e) {
        return null
      }
    })
  })
  const bookInfoList = await Promise.all(promiseList)
  return bookInfoList.filter(notEmpty)
}
