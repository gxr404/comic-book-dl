import { expect, test, describe } from 'vitest'
import { Baozi } from '@/lib/parse/baozi'
import type { BookInfo } from '@/lib/parse/base'
import { existsMkdir, getUrlFileName } from '@/utils'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

describe('parseBookInfo', () => {
  test('parse Info', async () => {
    const baozi = new Baozi('https://www.fzmanga.com/comic/sishenjingjie-jiubaodairen')
    const _bookInfo = await baozi.parseBookInfo()
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
    const baozi = new Baozi('https://www.fzmanga.com/comic/sishenjingjie-jiubaodairen')
    const _bookInfo = await baozi.parseBookInfo()
    expect.soft(_bookInfo).not.toBeFalsy()
    const bookInfo = _bookInfo as BookInfo
    expect.soft(bookInfo.name).toBeTruthy()
    expect.soft(bookInfo.pathName).toBeTruthy()
    expect.soft(bookInfo.name).toBe('死神/境·界【快】')
    expect.soft(bookInfo.pathName).toBe('死神_境·界【快】')
  })

  test('parse Info preChapters and nextChapters', async () => {
    const baozi = new Baozi('https://www.fzmanga.com/comic/sishenjingjie-jiubaodairen')
    const _bookInfo = await baozi.parseBookInfo()
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
    const baozi = new Baozi('https://www.fzmanga.com/comic/1233')
    const isSuccess = await baozi.parseBookInfo()
    expect.soft(isSuccess).toBeFalsy()
  })

  test('test language', async () => {
    const wwwUrl = 'https://www.fzmanga.com/comic/sishenjingjie-jiubaodairen'
    const baozi = new Baozi(wwwUrl)
    let wwwBookInfo = await baozi.parseBookInfo()
    expect.soft(wwwBookInfo).not.toBeFalsy()
    wwwBookInfo = wwwBookInfo as BookInfo
    expect(wwwBookInfo.language).toMatch(/简体|繁體/)
    expect(wwwBookInfo.url).toMatch(/https:\/\/(cn\.|tw\.)./)
    expect(wwwBookInfo.rawUrl).toMatch(wwwUrl)

    const emptyPreUrl = 'https://fzmanga.com/comic/sishenjingjie-jiubaodairen'
    const baozi2 = new Baozi(emptyPreUrl)
    let emptyPreBookInfo = await baozi2.parseBookInfo()
    expect.soft(emptyPreBookInfo).not.toBeFalsy()
    emptyPreBookInfo = emptyPreBookInfo as BookInfo
    expect(emptyPreBookInfo.language).toMatch(/简体|繁體/)
    expect(emptyPreBookInfo.url).toMatch(/https:\/\/(cn\.|tw\.)./)
    expect(emptyPreBookInfo.rawUrl).toMatch(emptyPreUrl)

    const cnUrl = 'https://cn.fzmanga.com/comic/sishenjingjie-jiubaodairen'
    const baozi3 = new Baozi(cnUrl)
    let cnBookInfo = await baozi3.parseBookInfo()
    expect.soft(cnBookInfo).not.toBeFalsy()
    cnBookInfo = cnBookInfo as BookInfo
    expect.soft(cnBookInfo.language).toBe('简体')
    expect.soft(cnBookInfo.url).toBe(cnUrl)

    const twUrl = 'https://tw.fzmanga.com/comic/sishenjingjie-jiubaodairen'
    const baozi4 = new Baozi(twUrl)
    let twBookInfo = await baozi4.parseBookInfo()
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
    const baozi = new Baozi()
    const imgList = await baozi.getImgList(url)
    expect.soft(imgList).toHaveLength(6)

  })

  test('http 302 state', async () => {
    const url = 'https://www.fzmanga.com/user/page_direct?comic_id=sishenjingjie-jiubaodairen&section_slot=0&chapter_slot=0'
    const baozi = new Baozi()
    const imgList = await baozi.getImgList(url)
    expect.soft(imgList).toHaveLength(6)
  })

  test('paging', async () => {
    const url = 'https://www.fzmanga.com/comic/chapter/congdashukaishidejinhua-feihongzhiyeyuanzhuheiniaoshe/0_0.html'
    const baozi = new Baozi()
    const imgList = await baozi.getImgList(url)
    // 超过50会分页
    expect.soft(imgList.length).toBeGreaterThan(50)
  })

  test('image list unique', async() => {
    const url = 'https://cn.czmanga.com/comic/chapter/wushenhuiguilu-dcwebtoonbiz_538j9w/0_0.html'
    const baozi = new Baozi()
    const imgList = await baozi.getImgList(url)
    const uniqueList = new Set(imgList)
    expect.soft(imgList).toHaveLength(uniqueList.size)
  })
})

describe('saveImgList', () => {
  test('test download img success', async () => {
    const imgList = [
      'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/1.jpg',
      'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/2.jpg',
      'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/3.jpg',
    ]
    const testDistDir = path.join(__dirname, '../.temp/baozi/saveImgList/1')
    existsMkdir(testDistDir)
    const baozi = new Baozi()
    await baozi.saveImgList(testDistDir, imgList, () => {
      'use-a'
    })
    imgList.forEach(url => {
      expect(existsSync(`${testDistDir}/${getUrlFileName(url)}`)).toBe(true)
    })
  })
  test('has fail image', async () => {
    const imgList = [
      'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/1.jpg',
      "https://s1.baozicdn.com/scomic/1111"
    ]
    const testDistDir = path.join(__dirname, '../.temp/baozi/saveImgList/2')
    existsMkdir(testDistDir)
    let hasFail = false
    let failUrl: string[] = []
    const baozi = new Baozi()
    await baozi.saveImgList(
      testDistDir,
      imgList,
      function(imgUrl, isSuccess) {
        if (!isSuccess) {
          hasFail = true
          failUrl.push(imgUrl)
        }
      }
    )
    expect.soft(hasFail).toBeTruthy()
    expect.soft(failUrl).toHaveLength(1)
    expect.soft(failUrl[0]).toBe(imgList[1])
  })

  test('return image path list', async() => {
    const imgList = [
      'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/1.jpg',
      'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/2.jpg',
      'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/3.jpg',
    ]
    const testDistDir = path.join(__dirname, '../.temp/baozi/saveImgList/3')
    existsMkdir(testDistDir)
    const baozi = new Baozi()
    const imgPathList = await baozi.saveImgList(testDistDir, imgList)
    expect.soft(imgPathList).toHaveLength(3)
    expect.soft(imgPathList[0]).toBe('1.jpg')
    expect.soft(imgPathList[1]).toBe('2.jpg')
    expect.soft(imgPathList[2]).toBe('3.jpg')
  })
})

describe('saveImg',() => {
  test('normal saveImg', async () => {
    const testDistDir = path.join(__dirname, '../.temp/baozi/saveImg')

    existsMkdir(testDistDir)
    const imgUrl = 'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/1.jpg'
    const baozi = new Baozi()
    await baozi.saveImg(testDistDir, imgUrl)
    const data = readFileSync(`${testDistDir}/${getUrlFileName(imgUrl)}`)
    expect(data).toMatchSnapshot()
  })
})
