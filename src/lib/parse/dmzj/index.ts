import got from 'got'
import { load } from 'cheerio'
import { UA, fixPathName } from '../../../utils'
import { ApiV4ChapterImageParse, ApiV4ChapterListParse, ApiV4Decrypt } from './crypto'
import { ChaptersItem, BookInfo } from '../index'

const api = {
  v4Chapter: 'https://nnv4api.dmzj.com/comic/chapter/',
  v3Chapter: 'https://m.idmzj.com/chapinfo/',
  v3Api: 'https://api.dmzj.com',
  v4Api: 'https://nnv4api.dmzj.com'
}

function getHeaders() {
  return {
    'user-agent': UA
  }
}

export async function getImgList(url: string): Promise<string[]> {

  // urlPath = comic_id/id
  const urlPath = /.*view\/(.*).html/g.exec(url)?.[1]
  if (!urlPath) return []
  // https://m.idmzj.com/view/62324/140451.html
  const response = await got(`${api.v4Chapter}${urlPath}`, {
    headers: getHeaders()
  })
  let imgList: string[] = []
  try {
    const data = ApiV4ChapterImageParse(ApiV4Decrypt(response.body))
    imgList = data?.Images ?? []
    imgList = imgList.map(img => decodeURIComponent(img))
  } catch(e) {
    const response = await got(`${api.v3Chapter}${urlPath}.html`, {
      headers: getHeaders()
    })
    let data: any = {}
    try {
      data = JSON.parse(response.body)
    } catch (e) {
      console.log(e)
    }
    imgList = data['page_url']
  }

  return imgList
}

interface MobileTempChapterItem {
  chapter_name: string,
  chapter_order: number,
  chaptertype: number,
  comic_id: number,
  id: number,
  sort: number,
  title: string
}

interface PcTempChapterItem {
  chapter_id: number,
  chapter_title: string,
  updatetime: number,
  filesize: number,
  chapter_order: number,
  is_fee: boolean
}
export async function parseBookInfo(url: string): Promise<BookInfo | false> {
  const rawUrl = url

  let response: got.Response<string>
  try {
    response = await got.get(url, {
      headers: getHeaders()
    })
  } catch (e) {
    return false
  }
  if (!response || response.statusCode !== 200) {
    return false
  }

  const isMobile = /m\.idmzj/.test(url)
  let parseResult
  if (isMobile) {
    parseResult = parseRule.mSite(url, response.body)
  } else {
    parseResult = await parseRule.pcSite(url, response.body)
  }

  const name = parseResult?.name
  const author = parseResult?.author
  const desc = parseResult?.desc
  const coverUrl = parseResult?.coverUrl
  let chapters: ChaptersItem[] = parseResult?.chapters || []

  if (!name || chapters.length === 0) {
    return false
  }
  // 章节默认是升序改为降序
  chapters = chapters.reverse()

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


const parseRule = {
  // mobile https://m.idmzj.com/index.html
  mSite(url: string, body: string) {
    const $ = load(body)
    const name = $('#comicName').text().trim()
    const desc = $('.txtDesc.autoHeight').text().trim()
    const author = $('.introName').toArray().map(el => $(el).text()).join('/').trim()
    const coverUrl = $('#Cover img').attr('src')?.trim() ?? ''
    // 全部章节
    const chaptersReg = /initIntroData\((.*?)\)/gm
    const chaptersJSONstr = chaptersReg.exec(body)?.[1] ?? ''
    let tempChapters: MobileTempChapterItem[] = []
    try {
      tempChapters = JSON.parse(chaptersJSONstr)
    } catch (e) {
      console.log(e)
    }
    if (!Array.isArray(tempChapters)) tempChapters = []
    tempChapters = tempChapters.map((item: any) => item?.data ?? null)
    tempChapters = tempChapters.flat()

    const chapters: ChaptersItem[] = []
    const {origin} = new URL(url)

    tempChapters.forEach((item, index) => {
      const chapterIndex = item['chapter_order'] ?? index
      // /view/comic_id/id.html
      chapters.push({
        name: `${chapterIndex}_${fixPathName(item['chapter_name'])}`,
        rawName: item['chapter_name'],
        href: `${origin}/view/${item['comic_id']}/${item.id}.html`,
        imageList: [],
        imageListPath: [],
        index: chapterIndex,
        other: item
      })
    })
    return {
      name,
      author,
      desc,
      coverUrl,
      chapters,
    }
  },
  // pc https://www.idmzj.com/info/yaoshenji.html
  async pcSite(url: string, body: string) {
    const reg = /.*\/(.*?)$/
    const params: any = {}
    let comicName = url.match(reg)?.[1] || ''
    comicName = comicName.replace(/\.html/, '')
    params['comic_py'] = comicName
    const api = 'https://www.idmzj.com/api/v1/comic1/comic/detail'
    const nuxtDataStr = body.match(/window\.__NUXT__=\((.*)\)/gm)?.[0] || ''
    const fieldGroup = ['channel', 'app_name', 'version', 'timestamp']
    fieldGroup.forEach((field, i) => {
      const fieldReg = new RegExp(`${field}:(.*?),`)
      const key = fieldGroup[i]
      params[key] = nuxtDataStr.match(fieldReg)?.[1] || ''
    })
    const queryStr = new URLSearchParams(params).toString()
    const response = await got.get(`${api}?${queryStr}`, {
      headers: getHeaders()
    })
    let resJSON: any = null
    try {
      resJSON = JSON.parse(response.body)
      resJSON = resJSON?.data?.comicInfo || {}
    } catch (e) {
      console.log(e)
    }
    // const $ = load(body)
    // const name = $('.comic_deCon > h1 > a').text().trim()
    // const desc = $('.comic_deCon .comic_deCon_d').text().trim()
    // const author = $('.comic_deCon .comic_deCon_liO > li:nth-child(1)').text().trim()
    // const coverUrl = $('#Cover img').attr('src')?.trim() ?? ''
    const author = resJSON?.authorInfo?.authorName || ''
    const name = resJSON?.title || ''
    const desc = resJSON?.description || ''
    const coverUrl = resJSON?.cover || ''
    const chapters: ChaptersItem[] = []
    let tempChapters: PcTempChapterItem[] = resJSON?.chapterList || []
    if (tempChapters.length <= 0) {
      const comicId = resJSON?.id
      tempChapters = await parseRule.commonFetchChaptersList(comicId)
    } else {
      tempChapters = tempChapters.map((item: any) => item?.data ?? null)
      tempChapters = tempChapters.flat()
    }

    // const {origin} = new URL(url)
    tempChapters.forEach((item, index) => {
      const chapterIndex = item['chapter_order'] ?? index
      // /view/comic_id/id.html
      chapters.push({
        name: `${chapterIndex}_${fixPathName(item['chapter_title'])}`,
        rawName: item['chapter_title'],
        href: `https://m.idmzj.com/view/${resJSON?.id}/${item['chapter_id']}.html`,
        imageList: [],
        imageListPath: [],
        index: chapterIndex,
        other: item
      })
    })
    return {
      name,
      author,
      desc,
      coverUrl,
      chapters,
    }

  },

  /** 可公用的 获取章节 前提是需要 comic id */
  async commonFetchChaptersList(id: string) {
    if (!id) return []
    const url = `${api.v4Api}/comic/detail/${id}?uid=2665531`
    const response = await got.get(url, {headers: getHeaders()})
    let chapterList: any[] = []
    try {
      const data = ApiV4ChapterListParse(ApiV4Decrypt(response.body))
      const tempChapterList = data?.Chapters ?? []
      const dataFieldList = tempChapterList.map(item => item.Data)
      chapterList = dataFieldList.flat().map(item => {
        return {
          ['chapter_order']: item.ChapterOrder,
          ['chapter_title']: item.ChapterTitle,
          ['chapter_id']: item.ChapterId
        }
      })
    } catch (e) {
      // v3接口一直为空 暂时忽略
      // const v3Url = `${api.v3Api}/dynamic/comicinfo/${id}.json`
      return []
    }
    return chapterList.reverse()
  }
}