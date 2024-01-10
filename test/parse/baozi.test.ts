import { expect, test, describe } from 'vitest'
import { getImgList, parseBookInfo } from '../../src/lib/parse/baozi'
import type { BookInfo } from '../../src/lib/parse'

describe('parseBookInfo', () => {
  test('parse Info', async () => {
    const _bookInfo = await parseBookInfo('https://www.fzmanga.com/comic/sishenjingjie-jiubaodairen')
    expect.soft(_bookInfo).not.toBeFalsy()
    const bookInfo = _bookInfo as BookInfo
    expect.soft(bookInfo.name).toBeTruthy()
    expect.soft(bookInfo.url).toBeTruthy()
    expect.soft(bookInfo.author).toBeTruthy()
    expect.soft(bookInfo.coverUrl).toBeTruthy()
    expect.soft(bookInfo.desc).toBeTruthy()
    expect.soft(bookInfo.chapters.length).toBeGreaterThan(0)
  })

  test('解析时 漫画名含特殊字符', async () => {
    const _bookInfo = await parseBookInfo('https://cn.baozimh.com/comic/sishenjingjie-jiubaodairen')
    expect.soft(_bookInfo).not.toBeFalsy()
    const bookInfo = _bookInfo as BookInfo
    expect.soft(bookInfo.name).toBeTruthy()
    expect.soft(bookInfo.pathName).toBeTruthy()
    expect.soft(bookInfo.name).toBe('死神/境·界')
    expect.soft(bookInfo.pathName).toBe('死神_境·界')
  })

  test('parse Info preChapters and nextChapters', async () => {
    const _bookInfo = await parseBookInfo('https://www.fzmanga.com/comic/sishenjingjie-jiubaodairen')
    expect.soft(_bookInfo).not.toBeFalsy()
    const bookInfo = _bookInfo as BookInfo

    expect.soft(bookInfo.chapters[0].preChapter).toBeUndefined()
    expect.soft(bookInfo.chapters[0].nextChapter).toHaveProperty('name')
    expect.soft(bookInfo.chapters[0].nextChapter).toHaveProperty('href')

    const lastIndex = bookInfo.chapters.length - 1
    expect.soft(bookInfo.chapters[lastIndex].nextChapter).toBeUndefined()
    expect.soft(bookInfo.chapters[lastIndex].preChapter).toHaveProperty('name')
    expect.soft(bookInfo.chapters[lastIndex].preChapter).toHaveProperty('href')
  })

  test('error url',async () => {
    const isSuccess = await parseBookInfo('https://www.fzmanga.com/comic/1233')
    expect.soft(isSuccess).toBeFalsy()
  })

  test('test language', async () => {
    const wwwUrl = 'https://www.fzmanga.com/comic/sishenjingjie-jiubaodairen'
    let wwwBookInfo = await parseBookInfo(wwwUrl)
    expect.soft(wwwBookInfo).not.toBeFalsy()
    wwwBookInfo = wwwBookInfo as BookInfo
    expect(wwwBookInfo.language).toMatch(/简体|繁體/)
    expect(wwwBookInfo.url).toMatch(/https:\/\/(cn\.|tw\.)./)
    expect(wwwBookInfo.rawUrl).toMatch(wwwUrl)

    const emptyPreUrl = 'https://fzmanga.com/comic/sishenjingjie-jiubaodairen'
    let emptyPreBookInfo = await parseBookInfo(emptyPreUrl)
    expect.soft(emptyPreBookInfo).not.toBeFalsy()
    emptyPreBookInfo = emptyPreBookInfo as BookInfo
    expect(emptyPreBookInfo.language).toMatch(/简体|繁體/)
    expect(emptyPreBookInfo.url).toMatch(/https:\/\/(cn\.|tw\.)./)
    expect(emptyPreBookInfo.rawUrl).toMatch(emptyPreUrl)

    const cnUrl = 'https://cn.fzmanga.com/comic/sishenjingjie-jiubaodairen'
    let cnBookInfo = await parseBookInfo(cnUrl)
    expect.soft(cnBookInfo).not.toBeFalsy()
    cnBookInfo = cnBookInfo as BookInfo
    expect.soft(cnBookInfo.language).toBe('简体')
    expect.soft(cnBookInfo.url).toBe(cnUrl)

    const twUrl = 'https://tw.fzmanga.com/comic/sishenjingjie-jiubaodairen'
    let twBookInfo = await parseBookInfo(twUrl)
    expect.soft(twBookInfo).not.toBeFalsy()
    twBookInfo = twBookInfo as BookInfo
    expect.soft(twBookInfo.language).toBe('繁體')
    // expect.soft(twBookInfo.url).toBe(twUrl)
    // 繁体也转简体的链接
    expect.soft(twBookInfo.url).toBe(cnUrl)

  })
})

describe('getImgList', () => {
  test('normal', async () => {
    const url = 'https://www.fzmanga.com/comic/chapter/sishenjingjie-jiubaodairen/0_0.html'
    const imgList = await getImgList(url)
    expect.soft(imgList).toHaveLength(6)

  })

  test('http 302 state', async () => {
    const url = 'https://www.fzmanga.com/user/page_direct?comic_id=sishenjingjie-jiubaodairen&section_slot=0&chapter_slot=0'
    const imgList = await getImgList(url)
    expect.soft(imgList).toHaveLength(6)
  })

  test('paging', async () => {
    const url = 'https://www.fzmanga.com/comic/chapter/congdashukaishidejinhua-feihongzhiyeyuanzhuheiniaoshe/0_0.html'
    const imgList = await getImgList(url)
    // 超过50会分页
    expect.soft(imgList.length).toBeGreaterThan(50)
  })

  test('image list unique', async() => {
    const url = 'https://cn.czmanga.com/comic/chapter/wushenhuiguilu-dcwebtoonbiz_538j9w/0_0.html'
    const imgList = await getImgList(url)
    const uniqueList = new Set(imgList)
    expect.soft(imgList).toHaveLength(uniqueList.size)
  })
})