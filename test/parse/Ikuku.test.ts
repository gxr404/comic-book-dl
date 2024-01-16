import { expect, test, describe } from 'vitest'
import type { BookInfo } from '@/lib/parse/base'
import { Ikuku } from '@/lib/parse/ikuku'

describe('parseBookInfo', () => {
  test('parseBookInfo正常解析', async () => {
    // http://mh123.dypro.xyz/comiclist/2262/
    const ikuku = new Ikuku('https://m.ikuku.cc/comiclist/4/')
    const _bookInfo = await ikuku.parseBookInfo()
    expect.soft(_bookInfo).not.toBeFalsy()
    const bookInfo = _bookInfo as BookInfo
    expect.soft(bookInfo.name).toBeTruthy()
    expect.soft(bookInfo.url).toBeTruthy()
    expect.soft(bookInfo.author).toBeTruthy()
    expect.soft(bookInfo.coverUrl).toBeTruthy()
    expect.soft(bookInfo.desc).toBeTruthy()
    expect.soft(bookInfo.chapters.length).toBeGreaterThan(100)
  })

  test('parse Info preChapters and nextChapters', async () => {
    const ikuku = new Ikuku('https://m.ikuku.cc/comiclist/4/')
    const _bookInfo = await ikuku.parseBookInfo()
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
    const ikuku = new Ikuku('https://m.ikuku.cc/comiclist/42434')
    const isSuccess = await ikuku.parseBookInfo()
    expect.soft(isSuccess).toBeFalsy()
  })
})

describe('getImgList', () => {
  test('getImgList正常解析', async () => {
    const ikuku = new Ikuku()
    const url = 'http://mh123.dypro.xyz/comiclist/4/112706/1.htm'
    const imgList = await ikuku.getImgList(url)
    expect.soft(imgList).toHaveLength(15)
  })
})