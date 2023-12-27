import { load } from "cheerio"
import got from "got"
import fs from "fs"
import path from "path"
import { pipeline } from "stream/promises"
import pLimit from 'p-limit'
import type { Config } from "./config"
import ProgressBar from "./ProgressBar"
import logger from './log'
import { UA } from "./utils"

export async function getImgList(url: string): Promise<string[]> {
  const response = await got(url, {
    headers: {
      "user-agent": UA
    }
  })
  const $ = load(response.body)
  const ampState = $('.comic-contain amp-state')

  let imgList = ampState.toArray().map((el: any) => {
    const scriptText = $(el).find('script').text()
    const jsonData = JSON.parse(scriptText)
    return jsonData?.url as string ?? ''
  })

  const nextChapterList = $('.comic-chapter .next_chapter').toArray()
  const findIndex = nextChapterList.length > 1 ? 1 : 0
  const nextChapterEl = $(nextChapterList[findIndex]).find('a')
  const nextChapterHref = nextChapterEl.attr('href')
  const nextChapterText = nextChapterEl.text()
  if (/下一頁|下一页/g.test(nextChapterText) && nextChapterHref) {
    const nextImgList = await getImgList(nextChapterHref)
    imgList = imgList.concat(nextImgList)
  }
  return [...new Set(imgList)]
}

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

export function getImageName(url: string) {
  if (!url) return ''
  const urlObj = new URL(url)
  return urlObj.pathname.split('/').at(-1)
}

export async function saveImg(path: string, imgUrl: string, fixFileName?: string) {
  if (!imgUrl) return ''
  let imgName = getImageName(imgUrl) ?? ''
  if (fixFileName) {
    const suffix = imgName?.split('.')?.[1] ?? 'jpg'
    imgName = `${fixFileName}.${suffix}`
  }
  await pipeline(
    got.stream(imgUrl, {
      headers: {
        "user-agent": UA
      }
    }),
    fs.createWriteStream(`${path}/${imgName}`)
  )
  return imgName
}

interface ChaptersItem {
  name: string,
  rawName: string,
  href: string,
  imageList: string[],
  imageListPath: string[]
  preChapter?: {
    name: string,
    href: string,
    rawName: string
  },
  nextChapter?: {
    name: string,
    href: string,
    rawName: string
  },
}
export interface BookInfo {
  name: string,
  author: string,
  desc: string,
  coverUrl: string,
  coverPath: string
  chapters: ChaptersItem[]
}
interface ErrorItem {
  bookName: string,
  imgUrl: string,
  chapter:  ChaptersItem
}
interface ChapterErrorMsgItem {
  chapterName: string,
  imgList: string[]
}
export async function parseBookInfo(url: string): Promise<BookInfo | false> {
  let response: got.Response<string>
  try {
    response = await got.get(url, {
      headers: {
        "user-agent": UA
      }
    })
  } catch (e) {
    return false
  }
  if (!response || response.statusCode !== 200) {
    return false
  }
  const $ = load(response.body)
  const name = $('.comics-detail__info .comics-detail__title').text().trim()
  const desc = $('.comics-detail__info .comics-detail__desc').text().trim()
  const author = $('.comics-detail__info .comics-detail__author').text().trim()
  const coverUrl = $('.l-content .pure-g.de-info__box amp-img').attr('src')?.trim() ?? ''
  const chaptersEl = $('#chapter-items a.comics-chapters__item, #chapters_other_list a.comics-chapters__item')
  let chapters: ChaptersItem[] = []
  const {origin} = new URL(url)

  chaptersEl.toArray().forEach((el: any, index: number) => {
    const target = $(el)
    const name = target.find('span').text().trim()
    const href = target.attr('href')?.trim() ?? ''
    chapters.push({
      name: `${index}_${fixPathName(name)}`,
      rawName: name,
      href: `${origin}${href}`,
      imageList: [],
      imageListPath: []
    })
  })
  // 生成上一话/下一话信息
  chapters = chapters.map((item, index) => {
    const newItem = {...item}
    if (index !== 0) {
      newItem.preChapter = {
        name: chapters[index - 1].name,
        rawName: chapters[index - 1].rawName,
        href: chapters[index - 1].href
      }
    }
    if (index !== chapters.length - 1){
      newItem.nextChapter = {
        name: chapters[index + 1].name,
        rawName: chapters[index + 1].rawName,
        href: chapters[index + 1].href
      }
    }
    return newItem
  })

  if (!name || chapters.length === 0) {
    return false
  }

  return {
    name,
    author,
    desc,
    coverUrl,
    coverPath: '',
    chapters
  }
}

export function fixPathName(path: string) {
  if (!path) return ''
  const dirNameReg = /[\\/:*?"<>|\n\r]/g
  return path.replace(dirNameReg, '_').replace(/\s/g, '')
}

export function existsMkdir(path: string) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, {recursive: true})
  }
}

export async function writeBookInfoFile(bookInfo: BookInfo, bookDistPath: string) {
  const coverPicPath = await saveImg(bookDistPath, bookInfo.coverUrl, 'cover')
  bookInfo.coverPath = coverPicPath
  fs.writeFileSync(`${bookDistPath}/bookInfo.json`, JSON.stringify(bookInfo, null, 2))
}

export async function echoErrorMsg(
    bookName: string,
    errorList: ErrorItem[],
    chaptersList: ChaptersItem[]
  ) {
  const errChaptersMsg: ChapterErrorMsgItem[] = []
  errorList.forEach((item)=>{
    const errChapter = errChaptersMsg.find(msg => {
      return msg.chapterName === item.chapter.name
    })
    if (errChapter) {
      errChapter.imgList.push(item.imgUrl)
    } else {
      errChaptersMsg.push({
        chapterName: item.chapter.name,
        imgList: [item.imgUrl]
      })
    }
  })

  logger.error(`《${bookName}》本次执行总数${chaptersList.length}话，✕ 失败${errChaptersMsg.length}话`)
  for (const errInfo of errChaptersMsg) {
    logger.error(`└── ✕ ${errInfo.chapterName}`)
    errInfo.imgList.forEach(imgUrl => {
      logger.error(` └── ${imgUrl}`)
    })
  }
  logger.error(`o(╥﹏╥)o 由于网络波动或链接失效以上下载失败，可重新执行命令重试(PS:不会影响已下载成功的数据)`)
}

export async function main(config: Config) {
  const bookInfo = await parseBookInfo(config.targetUrl)
  if (!bookInfo) {
    logger.error('× 请输入正确的url... o(╥﹏╥)o')
    return
  }

  const bookName = bookInfo.name

  const bookDistPath = path.resolve(config.bookPath, fixPathName(bookInfo.name))

  existsMkdir(bookDistPath)

  const total =  bookInfo.chapters.length
  const progressBar = new ProgressBar(bookDistPath, total)
  await progressBar.init()
  if (progressBar.curr === total) {
    if (progressBar.bar) progressBar.bar.stop()
    logger.info(`√ 已完成: ${bookDistPath}`)
    return
  }

  logger.info(`开始下载 《${bookName}》`)
  let chaptersList = bookInfo.chapters

  // 下载中断 重新获取下载进度数据
  if (progressBar.isDownloadInterrupted) {
    chaptersList = chaptersList.filter((chaptersItem) => {
      return !progressBar.progressInfo.some(item => {
        const isFind = item.href === chaptersItem.href
        if (isFind) {
          chaptersItem.imageList = item.imageList
          chaptersItem.imageListPath = item.imageListPath
        }
        return isFind
      })
    })
  }

  const LIMIT_MAX = 10

  const limit = pLimit(LIMIT_MAX)

  const errorList: ErrorItem[] = []

  const promiseList = chaptersList.map(item => {
    return limit(async () => {
      const chaptersItemPath = `${bookDistPath}/chapters/${item.name}`
      existsMkdir(chaptersItemPath)
      const imageList = await getImgList(item.href)
      let imageListPath: string[] = []
      const curBar = progressBar.multiBar!.create(imageList.length, 0, {
        file: `下载「${item.name}」中的图片...`
      })

      let isAllSuccess = true
      imageListPath = await saveImgList(
        chaptersItemPath,
        imageList,
        (imgUrl: string, isSuccess: boolean) => {
          if (!isSuccess) {
            isAllSuccess = false
            errorList.push({
              bookName,
              imgUrl,
              chapter: item
            })
          }
          curBar.increment()
        }
      )
      imageListPath = imageListPath.map((itemPath) => {
        return `chapters/${item.name}/${itemPath}`
      })
      item.imageList = imageList
      item.imageListPath = imageListPath
      progressBar.multiBar!.remove(curBar)
      await progressBar.updateProgress({
        path: chaptersItemPath,
        href: item.href,
        imageList,
        imageListPath
      }, isAllSuccess)
      return isAllSuccess
    })
  })

  const isAllSuccess = await Promise.all(promiseList)

  await writeBookInfoFile(bookInfo, bookDistPath)

  if (errorList.length > 0) {
    echoErrorMsg(bookName, errorList, chaptersList)
  } else if (progressBar.curr === total && isAllSuccess) {
    logger.info(`√ 已完成: ${bookDistPath}`)
  }
  process.exit(0)
}
