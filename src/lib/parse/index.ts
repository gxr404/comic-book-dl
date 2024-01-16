import { Dmzj } from '@/lib/parse/dmzj'
import { Baozi } from '@/lib/parse/baozi'
import { Baimangu } from '@/lib/parse/baimangu'
import { Godamanga } from '@/lib/parse/godamanga'
import { Ikuku } from './ikuku'

const ruleMap = [
  {
    /** 包子漫画 排除掉baozi.one 因为是godamanga的镜像站 */
    hostRule: /(.*?)baozi(.*)\.(?!one)|(.*?)fzmanga(.*?)/,
    parse: {
      getInstance(url: string) {
        return new Baozi(url)
      },
      // url预处理
      preHandleUrl(url: string) {
        return url.replace(/tw\.|www\./, 'cn.')
      },
    }
  },
  {
    /** 动漫之家 */
    hostRule: /(.*?)dmzj(.*?)/,
    parse: {
      getInstance(url: string) {
        return new Dmzj(url)
      },
    }
  },
  {
    /** goda漫画和 goda镜像站包子漫画 */
    hostRule: /(.*?)godamanga(.*?)|(.*?)baozimh\.one(.*?)/,
    parse: {
      getInstance(url: string) {
        return new Godamanga(url)
      },
    }
  },
  {
    /** 百漫谷 */
    hostRule: /(.*?)darpou(.*?)/,
    parse: {
      getInstance(url: string) {
        return new Baimangu(url)
      }
    }
  },
  {
    /** ikuku */
    hostArr: [
      'mh123.dypro.xyz',
      'm.ikuku.cc'
    ],
    parse: {
      getInstance(url: string) {
        return new Ikuku(url)
      }
    }
  }
]

export function matchParse(url: string) {
  if (!url) return false
  const { host } = new URL(url)
  const ruleItem = ruleMap.find((item) => {
    if (item.hostRule) {
      return item.hostRule.test(host)
    } else if (item.hostArr) {
      return item.hostArr.includes(host)
    }
    return false
  })
  if (!ruleItem) return false
  return ruleItem.parse
}

