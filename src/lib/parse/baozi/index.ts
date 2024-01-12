import got, {Response} from 'got'
import { load } from 'cheerio'

import { Base } from '@/lib/parse/base'
import type { BookInfo, ChaptersItem } from '@/lib/parse/base'
import { fixPathName } from '@/utils'

export class Baozi extends Base {
  override readonly type = 'baozi'
  async getImgList(chapterUrl: string): Promise<string[]> {
    const response = await got(chapterUrl, this.genReqOptions())
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
    // baozi 页数超过50则会有下一页, 递归执行直到没有下一页
    if (/下一頁|下一页/g.test(nextChapterText) && nextChapterHref) {
      const nextImgList = await this.getImgList(nextChapterHref)
      imgList = imgList.concat(nextImgList)
    }
    return [...new Set(imgList)]
  }

  async parseBookInfo(): Promise<BookInfo | false> {
    let url = this.bookUrl
    const rawUrl = url
    let response: Response<string>
    try {
      response = await got.get(url, this.genReqOptions())
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
    // 全部章节
    const chaptersEl = $('#chapter-items a.comics-chapters__item, #chapters_other_list a.comics-chapters__item')

    let language = $('.header .home-menu .pure-menu-list:nth-of-type(2) .pure-menu-item:nth-of-type(2) > a').text()?.trim() ?? ''
    const realLanguage = language === '繁體' ? '简体' : '繁體'
    language = language && realLanguage

    if (language) {
      const hostnameMap = new Map([
        ['繁體', 'tw'],
        ['简体', 'cn']
      ])
      const newHostName = hostnameMap.get(language)
      if (newHostName) {
        // xxx.aaa.com -> cn.aaa.com
        // aaa.com -> cn.aaa.com
        url = url.replace(/(http|https):\/\/(www\.)?([^.\s]+)\.(com)/, `$1://${newHostName}.$3.$4`)
        // 不管繁体简体都用 cn.xx.com
        // 因为墙内也没法访问tw域名也会转cn域名
        // tw.xx.com -> cn.xxx.com
        url = url.replace(/tw\./, 'cn.')
      }
    }

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

    // 没有全部章节 尝试取最新章节(新上架的漫画仅有 最新章节， 没有全部章节)
    if (chapters.length === 0) {
      const chaptersEl = $('#layout > div.comics-detail > div:nth-child(3) > div > div:nth-child(4) a.comics-chapters__item')
      chaptersEl.toArray().forEach((el: any, index: number) => {
        const target = $(el)
        const name = target.find('span').text().trim()
        const href = target.attr('href')?.trim() ?? ''
        chapters.unshift({
          name: `${index}_${fixPathName(name)}`,
          rawName: name,
          href: `${origin}${href}`,
          imageList: [],
          imageListPath: [],
          index
        })
      })
      // fix index name
      chapters = chapters.map((item, index) => {
        return {
          ...item,
          name: `${index}_${fixPathName(item.rawName)}`,
          index,
        }
      })
    }

    if (!name || chapters.length === 0) {
      return false
    }

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

    return {
      name,
      pathName: fixPathName(name),
      author,
      desc,
      coverUrl,
      coverPath: '',
      chapters,
      url,
      language,
      rawUrl
    }
  }
}