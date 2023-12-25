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

  let imgList = ampState.toArray().map((el) => {
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
  return imgList
}

type TSaveImgCallback = (imgPath: string, isSuccess: boolean) => void
export async function saveImgList(path: string, imgList: string[], saveImgCallback?: TSaveImgCallback) {
  const limit = pLimit(10)
  const promiseList = imgList.map(imgUrl => limit(async () => {
    let isSuccess = true
    let imgPath = ''
    try {
      imgPath = await saveImg(path, imgUrl)
      imgPath = `${path}/${imgPath}`
    } catch(err) {
      // console.error(`save img Error: ${imgUrl}`)
      // console.error(err)
      isSuccess = false
    }
    if (typeof saveImgCallback === 'function') saveImgCallback(imgPath, isSuccess)
  }))
  await Promise.all(promiseList)
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
  href: string,
  imageList: string[],
  imageListPath: string[]
}
export interface BookInfo {
  name: string,
  author: string,
  desc: string,
  coverUrl: string,
  coverPath: string
  chapters: ChaptersItem[]
}
export async function parseBookInfo(url: string): Promise<BookInfo> {
  const response = await got.get(url, {
    headers: {
      "user-agent": UA //"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  })
  const $ = load(response.body)
  const name = $('.comics-detail__info .comics-detail__title').text().trim()
  const desc = $('.comics-detail__info .comics-detail__desc').text().trim()
  const author = $('.comics-detail__info .comics-detail__author').text().trim()
  const coverUrl = $('.l-content .pure-g.de-info__box amp-img').attr('src')?.trim() ?? ''

  const chaptersEl = $('#chapter-items a.comics-chapters__item, #chapters_other_list a.comics-chapters__item')
  const chapters: ChaptersItem[] = []
  const {origin} = new URL(url)

  chaptersEl.toArray().forEach((el) => {
    const target = $(el)
    const name = target.find('span').text().trim()
    const href = target.attr('href')?.trim() ?? ''
    chapters.push({
      name: fixPathName(name),
      href: `${origin}${href}`,
      imageList: [],
      imageListPath: []
    })
  })

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

export async function main(config: Config) {
  const bookInfo = await parseBookInfo(config.targetUrl)
  const bookDistPath = path.resolve(config.bookPath, fixPathName(bookInfo.name)) // `${config.bookPath}/${fixPathName(bookInfo.name)}`

  existsMkdir(bookDistPath)

  const total =  bookInfo.chapters.length
  const progressBar = new ProgressBar(bookDistPath, total)
  await progressBar.init()

  if (progressBar.curr === total) {
    if (progressBar.bar) progressBar.bar.stop()
    logger.info(`√ 已完成: ${bookDistPath}`)
    return
  }
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

  const promiseList = chaptersList.map(item => {
    return limit(async () => {
      const chaptersItemPath = `${bookDistPath}/chapters/${item.name}`
      existsMkdir(chaptersItemPath)
      const imageList = await getImgList(item.href)
      const imageListPath: string[] = []
      const curBar = progressBar.multiBar!.create(imageList.length, 0, {
        file: `下载 "${item.name}" 中的图片...`
      })
      let isAllSuccess = true
      await saveImgList(
        chaptersItemPath,
        imageList,
        (imgPath: string, isSuccess: boolean) => {
          if (!isSuccess) {
            isAllSuccess = false
          } else {
            imageListPath.push(imgPath)
          }
          curBar.increment()
        }
      )
      item.imageList = imageList
      item.imageListPath = imageListPath
      progressBar.multiBar!.remove(curBar)
      await progressBar.updateProgress({
        path: chaptersItemPath,
        href: item.href,
        imageList,
        imageListPath
      }, isAllSuccess)
    })
  })

  await Promise.all(promiseList)
  // progressBar.continue()
  // bookInfo.chapters.forEach(async (item) => {
  //   const chaptersItemPath = `${bookDistPath}/chapters/${item.name}`
  //   existsMkdir(chaptersItemPath)
  //   const imageList = await getImgList(item.href)
  //   saveImgList(chaptersItemPath, imageList)
  // })

  await writeBookInfoFile(bookInfo, bookDistPath)

  if (progressBar.curr === total) {
    logger.info(`√ 已完成: ${bookDistPath}`)
  }
  process.exit(0)
}


export async function writeBookInfoFile(bookInfo: BookInfo, bookDistPath: string) {
  const coverPicPath = await saveImg(bookDistPath, bookInfo.coverUrl, 'cover')
  bookInfo.coverPath = coverPicPath
  fs.writeFileSync(`${bookDistPath}/bookInfo.json`, JSON.stringify(bookInfo, null, 2))
}