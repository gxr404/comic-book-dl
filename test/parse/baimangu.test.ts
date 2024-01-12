import path from 'node:path'
import { readFileSync } from 'fs'
import { expect, test, describe } from 'vitest'
import type { BookInfo } from '@/lib/parse/base'
import { Baimangu } from '@/lib/parse/baimangu'
import { existsMkdir, getUrlFileName } from '@/utils'

describe('parseBookInfo', () => {
  test('parseBookInfo正常解析', async () => {
    const baimangu = new Baimangu('https://www.darpou.com/book/73839.html')
    const _bookInfo = await baimangu.parseBookInfo()
    expect.soft(_bookInfo).not.toBeFalsy()
    const bookInfo = _bookInfo as BookInfo
    expect.soft(bookInfo.name).toBeTruthy()
    expect.soft(bookInfo.url).toBeTruthy()
    expect.soft(bookInfo.author).toBeTruthy()
    expect.soft(bookInfo.coverUrl).toBeTruthy()
    expect.soft(bookInfo.desc).toBeTruthy()
    expect.soft(bookInfo.chapters.length).toBeGreaterThan(0)
  })
  test('parse Info preChapters and nextChapters', async () => {
    const baimangu = new Baimangu('https://www.darpou.com/book/73839.html')
    const _bookInfo = await baimangu.parseBookInfo()
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
    const baimangu = new Baimangu('https://www.darpou.com/book/222')
    const isSuccess = await baimangu.parseBookInfo()
    expect.soft(isSuccess).toBeFalsy()
  })
})


describe('getImgList', () => {
  test('getImgList正常解析', async () => {
    const baimangu = new Baimangu()
    const url = 'https://www.darpou.com/zhangjie/73839-1-1.html'
    const imgList = await baimangu.getImgList(url)
    expect.soft(imgList).toHaveLength(9)
  })
})

// TODO 快照过大

// test('baimangu saveImg', async () => {
//   const testDistDir = path.resolve(__dirname, '../.temp/baimangu/saveImg')
//   existsMkdir(testDistDir)
//   const imgUrl = 'http://img3.manga8.xyz/cocomh/tupian/8541/1/cc24447840468c205fec0c37da236bed.jpg'
//   const baimangu = new Baimangu()
//   await baimangu.saveImg(testDistDir, imgUrl)
//   const data = readFileSync(`${testDistDir}/${getUrlFileName(imgUrl)}`)
//   expect(data).toMatchSnapshot()
// })

