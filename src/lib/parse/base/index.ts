import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import got from 'got'
import pLimit from 'p-limit'
import { UA, getUrlFileName } from '@/utils'

export type TSaveImgCallback = (imgUrl: string, isSuccess: boolean) => void

export interface ChaptersItem {
  name: string,
  rawName: string,
  index: number,
  href: string,
  imageList: string[],
  imageListPath: string[]
  preChapter?: {
    name: string,
    href: string,
    rawName: string,
    index: number
  },
  nextChapter?: {
    name: string,
    href: string,
    rawName: string,
    index: number
  },
  other?: {
    [key: string]: any
  }
}

export interface BookInfo {
  name: string,
  pathName: string,
  author: string,
  desc: string,
  coverUrl: string,
  coverPath: string,
  chapters: ChaptersItem[],
  url: string,
  language: string,
  rawUrl: string,
  /** 是否完结 */
  isEnd?: boolean
}

export abstract class Base {
  readonly type: string = 'base'
  /* 漫画目录url */
  bookUrl: string
  constructor(bookUrl?: string) {
    this.bookUrl = bookUrl ?? ''
  }
  /** got请求配置 */
  genReqOptions() {
    return {
      headers: {
        'user-agent': UA
      }
    }
  }
  /** 通用保存图片列表方法 */
  async saveImgList(
    path: string,
    imgList: string[],
    saveImgCallback?: TSaveImgCallback) {
    const limit = pLimit(6)

    const promiseList = imgList.map(imgUrl => limit(async () => {
      let isSuccess = true
      // let imgPath = ''
      let imgFileName = ''
      try {
        imgFileName = await this.saveImg(path, imgUrl)
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
  /** 通用保存图片方法 */
  async saveImg(path: string, imgUrl: string, fixFileName?: string, fixSuffix?: string) {
    if (!imgUrl) return ''
    let imgName = getUrlFileName(imgUrl) ?? ''
    imgName = decodeURIComponent(imgName)
    if (fixFileName) {
      const suffix = imgName?.split('.')?.[1] ?? 'jpg'
      imgName = `${fixFileName}.${fixSuffix ?? suffix}`
    }
    await pipeline(
      got.stream(imgUrl, this.genReqOptions()),
      createWriteStream(`${path}/${imgName}`)
    )
    return imgName
  }
  /**
   * 抽象方法需有继承类实现
   * 获取图片列表
   */
  abstract getImgList(chapterUrl: string): Promise<string[]>
  /**
   * 抽象方法需有继承类实现
   * 解析漫画信息
   */
  abstract parseBookInfo(): Promise<BookInfo | false>
}