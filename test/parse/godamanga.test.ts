import { expect, test, describe } from 'vitest'
import type { BookInfo } from '@/lib/parse/base'
import { Godamanga } from '@/lib/parse/godamanga'

describe('parseBookInfo', () => {
  test('parseBookInfo正常解析 baozi.one', async () => {
    const godamanga = new Godamanga('https://cn.baozimh.one/manga/quanqiubingfengwodazaolemorianquanwu')
    const _bookInfo = await godamanga.parseBookInfo()
    expect.soft(_bookInfo).not.toBeFalsy()
    const bookInfo = _bookInfo as BookInfo
    expect.soft(bookInfo.name).toBeTruthy()
    expect.soft(bookInfo.url).toBeTruthy()
    expect.soft(bookInfo.author).toBeTruthy()
    expect.soft(bookInfo.coverUrl).toBeTruthy()
    expect.soft(bookInfo.desc).toBeTruthy()
    expect.soft(bookInfo.chapters.length).toBeGreaterThan(100)
  })

  test('parseBookInfo正常解析 章节过少的情况', async () => {
    const godamanga = new Godamanga('https://cn.baozimh.one/manga/bianfuxiaqunyinghuiv3')
    const _bookInfo = await godamanga.parseBookInfo()
    expect.soft(_bookInfo).not.toBeFalsy()
    const bookInfo = _bookInfo as BookInfo
    expect.soft(bookInfo.name).toBeTruthy()
    expect.soft(bookInfo.url).toBeTruthy()
    expect.soft(bookInfo.author).toBeTruthy()
    expect.soft(bookInfo.coverUrl).toBeTruthy()
    expect.soft(bookInfo.desc).toBeTruthy()
    expect.soft(bookInfo.chapters).toHaveLength(9)
  })
  // 需科学上网 跳过该测试
  test.skip('parseBookInfo正常解析 godamanga.com', async () => {
    const godamanga = new Godamanga('https://cn.godamanga.com/manga/quanqiubingfengwodazaolemorianquanwu')
    const _bookInfo = await godamanga.parseBookInfo()
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
    const godamanga = new Godamanga('https://cn.baozimh.one/manga/quanqiubingfengwodazaolemorianquanwu')
    const _bookInfo = await godamanga.parseBookInfo()
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
    const godamanga = new Godamanga('https://cn.baozimh.one/book/222')
    const isSuccess = await godamanga.parseBookInfo()
    expect.soft(isSuccess).toBeFalsy()
  })
})

describe('getImgList', () => {
  test('getImgList正常解析', async () => {
    const godamanga = new Godamanga()
    const url = 'https://cn.baozimh.one/manga/quanqiubingfengwodazaolemorianquanwu/29310-039518950-201'
    const imgList = await godamanga.getImgList(url)
    expect.soft(imgList).toHaveLength(23)
  })
})

// TODO 快照过大

// test('godamanga saveImg', async () => {
//   const testDistDir = path.resolve(__dirname, '../.temp/godamanga/saveImg')
//   existsMkdir(testDistDir)
//   const imgUrl = 'https://s3-nl-01.godamanga.online/hp/quanqiubingfengwodazaolemorianquanwu/201/0_aa3c9f5c7b0f86c7a0aa78e70f1115d5.webp'
//   const godamanga = new Godamanga()
//   // webp结尾转jpg结尾
//   await godamanga.saveImg(testDistDir, imgUrl, '1', 'jpg')
//   const data = readFileSync(`${testDistDir}/1.jpg`)
//   expect(data).toMatchSnapshot()
// })

