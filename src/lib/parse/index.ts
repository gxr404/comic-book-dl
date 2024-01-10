import * as dmzj from './dmzj/index'
import * as baozi from './baozi/index'

const ruleMap = [
  {
    /** 包子漫画 */
    hostRule: /(.*?)baozi(.*?)/,
    parse: {
      parseBookInfo: baozi.parseBookInfo,
      getImgList: baozi.getImgList,
      // url预处理
      preHandleUrl(url: string) {
        return url.replace(/tw\.|www\./, 'cn.')
      }
    }
  },
  {
    /** 动漫之家 */
    hostRule: /(.*?)dmzj(.*?)/,
    parse: {
      parseBookInfo: dmzj.parseBookInfo,
      getImgList: dmzj.getImgList
    }
  }
]

export function matchParse(url: string) {
  if (!url) return false
  const { host } = new URL(url)
  const ruleItem = ruleMap.find((item) => {
    return item.hostRule.test(host)
  })
  if (!ruleItem) return false
  return ruleItem.parse
}

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
  rawUrl: string
}
