import vm from 'node:vm'
import got, { Response } from 'got'
import pLimit from 'p-limit'
import { load } from 'cheerio'
import { Base } from '@/lib/parse/base'
import type { BookInfo, ChaptersItem, TSaveImgCallback } from '@/lib/parse/base'
import { UA, fixPathName } from '@/utils'

export class Baimangu extends Base {
  override readonly type = 'Baimangu'

  async parseBookInfo(): Promise<false | BookInfo> {
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
    const $ = load(response.body)
    const name = $('.fed-deta-content .fed-part-eone.fed-font-xvi').text().trim()
    const desc = $('.fed-deta-content li.fed-col-xs12:nth-child(6) .fed-part-esan').text().trim()
    const author = $('.fed-deta-content li.fed-col-xs12:nth-child(1) a').text().trim()
    const coverUrl = $('.fed-main-info .fed-deta-info .fed-list-pics').attr('data-original')?.trim() ?? ''
    // 全部章节
    const chaptersEl = $('.fed-drop-boxs.fed-drop-btms.fed-matp-v ul:nth-child(2) li')

    let chapters: ChaptersItem[] = []
    chaptersEl.toArray().forEach((el: any, index: number) => {
      const target = $(el)
      const name = target.find('a').text().trim()
      const href = target.find('a').attr('href')?.trim() ?? ''
      chapters.push({
        name: `${index}_${fixPathName(name)}`,
        rawName: name,
        href,
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

    const reg = /var oScript=document\.createElement\('script'\);(.*)oScript\.src=txt_url;/s
    const jsStr = reg.exec(response.body)?.[1] ?? ''
    if (!jsStr) return []
    const context: any = {}

    try {
      vm.createContext(context)
      vm.runInContext(jsStr, context)
    } catch (e) {
      return []
    }

    const txtUrl = context['txt_url'] || ''
    if (!txtUrl) return []

    const resImgTxt = await got.get(txtUrl, this.genReqOptions())
    const imgReg = /.*?src="(.*?)"/mg
    let imgList: string[] = []
    let res = imgReg.exec(resImgTxt.body)
    while(res) {
      if (res[1]) {
        imgList.push(res[1])
      }
      res = imgReg.exec(resImgTxt.body)
    }
    imgList = imgList.map(img =>{
      return img
        .replace(/(.*)img.manga8.xyz(.*)/g, '$1img3.manga8.xyz$2')
        .replace(/(.*)img2.manga8.xyz(.*)/g, '$1img4.manga8.xyz$2')
    })

    return [...new Set(imgList)]
  }

  override genReqOptions() {
      return {
        headers: {
          'referrer': 'https://www.darpou.com/',
          'user-agent': UA
        }
      }
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
        imgFileName = await this.saveImg(path, imgUrl, String(index+1))
      } catch(err) {
        isSuccess = false
      }
      if (typeof saveImgCallback === 'function') saveImgCallback(imgUrl, isSuccess)
      return imgFileName
    }))
    return await Promise.all(promiseList)
  }
}