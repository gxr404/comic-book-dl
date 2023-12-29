import got from 'got'
import { load } from 'cheerio'
import { fixPathName, UA } from '../utils'

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
}

export interface BookInfo {
  name: string,
  author: string,
  desc: string,
  coverUrl: string,
  coverPath: string,
  chapters: ChaptersItem[],
  url: string
}

export async function getImgList(url: string): Promise<string[]> {
  const response = await got(url, {
    headers: {
      'user-agent': UA
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

export async function parseBookInfo(url: string): Promise<BookInfo | false> {
  let response: got.Response<string>
  try {
    response = await got.get(url, {
      headers: {
        'user-agent': UA
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
      imageListPath: [],
      index
    })
  })
  // 生成上一话/下一话信息
  chapters = chapters.map((item, index) => {
    const newItem = {...item}
    if (index !== 0) {
      newItem.preChapter = {
        name: chapters[index - 1].name,
        rawName: chapters[index - 1].rawName,
        href: chapters[index - 1].href,
        index: chapters[index - 1].index
      }
    }
    if (index !== chapters.length - 1){
      newItem.nextChapter = {
        name: chapters[index + 1].name,
        rawName: chapters[index + 1].rawName,
        href: chapters[index + 1].href,
        index: chapters[index + 1].index
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
    chapters,
    url
  }
}