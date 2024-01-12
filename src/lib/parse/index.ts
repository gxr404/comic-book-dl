import { Dmzj } from '@/lib/parse/dmzj'
import { Baozi } from '@/lib/parse/baozi'

const ruleMap = [
  {
    /** 包子漫画 */
    hostRule: /(.*?)baozi(.*?)|(.*?)fzmanga(.*?)/,
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

