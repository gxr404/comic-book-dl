import got, {Response} from 'got'
import { load } from 'cheerio'
import pLimit from 'p-limit'
import { Base } from '@/lib/parse/base'
import { fixPathName, sleep } from '@/utils'
import type { BookInfo, ChaptersItem, TSaveImgCallback } from '@/lib/parse/base'

export class Godamanga extends Base {
  override readonly type = 'Godamanga'

  async parseBookInfo(): Promise<BookInfo | false> {
    const url = this.bookUrl
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
    let $ = load(response.body)
    let name = $('#info .gap-unit-xs .text-xl').text().trim()
    const _name = $('#info .gap-unit-xs .text-xl .text-xs').text().trim()
    name = name.replace(_name, '').trim()
    const desc = $('#info .block .text-medium').text().trim()
    const author = $('#info .block div:nth-child(2) a span').text().trim()
    const coverUrl = $('#MangaCard > div > div:nth-child(1) img').attr('src')?.trim() ?? ''
    // 全部章节需 点击全部章节按钮 请求另一个页面
    const chaptersAllUrl = $('.my-unit-sm a').attr('href')
    let chapters: ChaptersItem[] = []
    const {origin} = new URL(url)

    // 如果有全部章节则 点击，没有则直接在当前页取 因为章节太少的可能会没有全部章节页
    if (chaptersAllUrl) {
      const chaptersAllHref = new URL(chaptersAllUrl, origin).href
      const res = await got.get(chaptersAllHref, this.genReqOptions()).catch(() => ({body: ''}))
      $ = load(res.body)
    }
    const chaptersElSelector = chaptersAllUrl ?
      '#chapterlists .chapteritem' :
      '.peer-checked\\:block #chapterlists .chapteritem'
    const chaptersEl =  $(chaptersElSelector)
    chaptersEl.toArray().forEach((el: any, index: number) => {
      const target = $(el)
      const name = target.find('.chaptertitle').text().trim()
      const href = target.find('a').attr('href')?.trim() ?? ''
      chapters.push({
        name: `${index}_${fixPathName(name)}`,
        rawName: name,
        href: `${origin}${href}`,
        imageList: [],
        imageListPath: [],
        index
      })
    })

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
      language: '简体',
      rawUrl
    }
  }
  async getImgList(chapterUrl: string): Promise<string[]> {
    const response = await got(chapterUrl, this.genReqOptions())
    const $ = load(response.body)

    const imgListEl = $('section .container .touch-manipulation .w-full.h-full img')

    const imgList = imgListEl.toArray().map((el: any) => {
      return $(el).attr('data-src') ?? $(el).attr('src') ?? ''
    })
    return [...new Set(imgList)]
  }

  override async saveImgList(
    path: string,
    imgList: string[],
    saveImgCallback?: TSaveImgCallback) {
    const limit = pLimit(6)

    const promiseList = imgList.map((imgUrl, index) => limit(async () => {
      let isSuccess = true
      // let imgPath = ''
      let imgFileName = ''
      try {
        // baimangu 特殊的 保存文件名 非顺序的数字 自定义index 去命名
        imgFileName = await this.saveImg(path, imgUrl, String(index+1), 'jpg')
      } catch(err) {
        isSuccess = false
      }
      if (typeof saveImgCallback === 'function') saveImgCallback(imgUrl, isSuccess)
      return imgFileName
    }))
    return await Promise.all(promiseList)
  }
  // ! 有访问限制 不能太快
  override async saveImg(path: string, imgUrl: string, fixFileName?: string | undefined, fixSuffix?: string | undefined): Promise<string> {
    await sleep(600)
    const res = await super.saveImg(path, imgUrl, fixFileName, fixSuffix)
    await sleep(600)
    return res
  }
}