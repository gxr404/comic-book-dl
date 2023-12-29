import { createWriteStream, writeFileSync } from 'node:fs'
import { readdir, stat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import got from 'got'
import pLimit from 'p-limit'
import { UA, getUrlFileName, notEmpty } from '../utils'
import { BookInfo } from './parse'

type TSaveImgCallback = (imgUrl: string, isSuccess: boolean) => void

export async function saveImgList(path: string, imgList: string[], saveImgCallback?: TSaveImgCallback) {
  const limit = pLimit(10)
  const promiseList = imgList.map(imgUrl => limit(async () => {
    let isSuccess = true
    // let imgPath = ''
    let imgFileName = ''
    try {
      imgFileName = await saveImg(path, imgUrl)
      // imgPath = `${path}/${imgFileName}`
    } catch(err) {
      // console.error(`save img Error: ${imgUrl}`)
      // console.error(err)
      isSuccess = false
    }
    if (typeof saveImgCallback === 'function') saveImgCallback(imgUrl, isSuccess)
    return imgFileName
  }))
  return await Promise.all(promiseList)
}



export async function saveImg(path: string, imgUrl: string, fixFileName?: string) {
  if (!imgUrl) return ''
  let imgName = getUrlFileName(imgUrl) ?? ''
  if (fixFileName) {
    const suffix = imgName?.split('.')?.[1] ?? 'jpg'
    imgName = `${fixFileName}.${suffix}`
  }
  await pipeline(
    got.stream(imgUrl, {
      headers: {
        'user-agent': UA
      }
    }),
    createWriteStream(`${path}/${imgName}`)
  )
  return imgName
}

export async function writeBookInfoFile(bookInfo: BookInfo, bookDistPath: string) {
  const coverPicPath = await saveImg(bookDistPath, bookInfo.coverUrl, 'cover')
  bookInfo.coverPath = coverPicPath
  writeFileSync(`${bookDistPath}/bookInfo.json`, JSON.stringify(bookInfo, null, 2))
}

export async function scanFolder(distPath: string) {
  const LIMIT_MAX = 10
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
