import got, {Response} from 'got'
import { load } from 'cheerio'
import pLimit from 'p-limit'
import { Base } from '@/lib/parse/base'
import { fixPathName, isHasHost, sleep, toReversed } from '@/utils'
import type { BookInfo, ChaptersItem, TSaveImgCallback } from '@/lib/parse/base'

export class Ikuku extends Base {
  override readonly type = 'Ikuku'

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
    const decoder = new TextDecoder('gbk')
    const $ = load(decoder.decode(response.rawBody))
    const name = $('#comicName').text().trim()
    const desc =$('.txtDesc').text().trim()
    const author = $('.Introduct_Sub .txtItme:nth-child(1)').text().trim()
    const coverUrl = $('#Cover img').attr('src')?.trim() ?? ''

    let chapters: ChaptersItem[] = []
    // const {origin} = new URL(url)
    const chaptersEl =  $('#list li')
    toReversed(chaptersEl.toArray()).forEach((el: any, index: number) => {
      const target = $(el)
      const aEl = target.find('a')
      const name = aEl.text().trim()
      const href = aEl.attr('href')?.trim() ?? ''
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
    const {origin} = new URL(this.bookUrl)
    const reqUrl = isHasHost(chapterUrl) ? chapterUrl : `${origin}${chapterUrl}`
    const response = await got(reqUrl, this.genReqOptions())
    const decoder = new TextDecoder('gbk')
    const bodyStr = decoder.decode(response.rawBody)
    const reg = /document\.write\("<a href='(.*?)'><IMG SRC='(.*?)'>/g
    const [, nextImgUrlPath, tempCurImgPath ] = reg.exec(bodyStr) ?? []
    if (!nextImgUrlPath || !tempCurImgPath) return []
    const nextImgUrl = `${origin}${nextImgUrlPath}`
    const isEnd = nextImgUrlPath.includes('exit')
    const imgHostMap = {} as {[key: string]: string}
    const scriptReg = /<script language='javascript' src='(.*?)'><\/script>/g
    const scriptMap = bodyStr.match(scriptReg)
    let imgHostString = ''
    if (Array.isArray(scriptMap)) {
      for (const item of scriptMap) {
        scriptReg.lastIndex = 0
        const scriptUrl = scriptReg.exec(item)?.[1] ?? ''
        if (!scriptUrl) continue
        const response = await got.get(`${origin}${scriptUrl}`, this.genReqOptions())
        imgHostString = imgHostString + '\n' + response.body
      }
    }
    if (imgHostString) {
      const matchArr = imgHostString.match(/\{(.*?)='(.*?)';\}/g)
      matchArr?.forEach(item => {
        const [, key, value] = /\{(.*?)='(.*?)';\}/.exec(item) || []
        if (key && value) {
          imgHostMap[key] = value
        }
      })
    }

    let curImgPath = tempCurImgPath
    Object.keys(imgHostMap).forEach(hostKey => {
      const host = imgHostMap[hostKey]
      curImgPath = curImgPath.replace(new RegExp('"\\+'+hostKey+'\\+"'), host)
    })
    if (!curImgPath) return []
    let imgList = [curImgPath]
    if (!isEnd && nextImgUrl) {
      const nextImgList = await this.getImgList(nextImgUrl)
      imgList = imgList.concat(nextImgList)
    }

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
        imgFileName = await this.saveImg(path, imgUrl, String(index+1))
      } catch(err) {
        isSuccess = false
      }
      if (typeof saveImgCallback === 'function') saveImgCallback(imgUrl, isSuccess)
      return imgFileName
    }))
    return await Promise.all(promiseList)
  }

  // 不要太快 ？？ 试试
  override async saveImg(path: string, imgUrl: string, fixFileName?: string | undefined, fixSuffix?: string | undefined): Promise<string> {
    await sleep(600)
    const res = await super.saveImg(path, imgUrl, fixFileName, fixSuffix)
    return res
  }
}