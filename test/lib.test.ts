import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { expect, test, describe } from 'vitest'
import { saveImg, saveImgList, scanFolder, writeBookInfoFile } from '../src/lib/download'
import { getUrlFileName, existsMkdir } from '../src/utils'
import { matchParse } from '../src/lib/parse'
import * as baoziParse from '../src/lib/parse/baozi'
import * as dmzjParse from '../src/lib/parse/dmzj'

describe('test saveImgList', () => {
  test('test download img success', async () => {
    const imgList = [
      'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/1.jpg',
      'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/2.jpg',
      'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/3.jpg',
    ]
    const testDistDir = `${__dirname}/.temp/saveImgList/1`
    existsMkdir(testDistDir)
    await saveImgList(testDistDir, imgList)
    imgList.forEach(url => {
      expect(existsSync(`${testDistDir}/${getUrlFileName(url)}`)).toBe(true)
    })
  })
  test('has fail image', async () => {
    const imgList = [
      'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/1.jpg',
      "https://s1.baozicdn.com/scomic/1111"
    ]
    const testDistDir = `${__dirname}/.temp/saveImgList/2`
    existsMkdir(testDistDir)
    let hasFail = false
    let failUrl: string[] = []
    await saveImgList(testDistDir, imgList, function(imgUrl, isSuccess) {
      if (!isSuccess) {
        hasFail = true
        failUrl.push(imgUrl)
      }
    })
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
    const testDistDir = `${__dirname}/.temp/saveImgList/3`
    existsMkdir(testDistDir)
    const imgPathList = await saveImgList(testDistDir, imgList)
    expect.soft(imgPathList).toHaveLength(3)
    expect.soft(imgPathList[0]).toBe('1.jpg')
    expect.soft(imgPathList[1]).toBe('2.jpg')
    expect.soft(imgPathList[2]).toBe('3.jpg')
  })
})

test('saveImg', async () => {
  const testDistDir = `${__dirname}/.temp/saveImg`

  existsMkdir(testDistDir)
  const imgUrl = 'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/1.jpg'
  await saveImg(testDistDir, imgUrl)
  const data = readFileSync(`${testDistDir}/${getUrlFileName(imgUrl)}`)
  expect(data).toMatchSnapshot()
})

describe('match parse', () => {
  test('baozi site', async () => {
    const siteArr = [
      'https://cn.baozimh.com/comic/yaoshenji-taxuedongman',
      'https://tw.baozimh.com/comic/yaoshenji-taxuedongman',
      'https://www.baozimh.com/comic/yaoshenji-taxuedongman',
    ]
    siteArr.forEach(site => {
      const matchObj = matchParse(site)
      expect.soft(matchObj).not.toBeFalsy()
      if (matchObj) {
        expect.soft(matchObj.getImgList).toBe(baoziParse.getImgList)
        expect.soft(matchObj.parseBookInfo).toBe(baoziParse.parseBookInfo)
      }
    })
  })

  test('dmzj site', async () => {
    const siteArr = [
      'https://m.idmzj.com/info/qishishiyimeizuijinchuxiandeyilididiguoyuqinmile.html',
      'https://www.idmzj.com/info/qishishiyimeizuijinchuxiandeyilididiguoyuqinmile.html'
    ]
    siteArr.forEach(site => {
      const matchObj = matchParse(site)
      expect.soft(matchObj).not.toBeFalsy()
      if (matchObj) {
        expect.soft(matchObj.getImgList).toBe(dmzjParse.getImgList)
        expect.soft(matchObj.parseBookInfo).toBe(dmzjParse.parseBookInfo)
      }
    })
  })
})

// describe('test main', () => {
//   test('mkdir book dir', async () => {
//     const testDistDir = `${__dirname}/.temp/main`

//     await main({
//       bookPath: testDistDir,
//       targetUrl: 'https://www.baozimh.com/comic/chuankechahuaji-chuanke'
//     })
//   })
// })


describe('writeBookInfoFile', async () => {
  const testDistDir = `${__dirname}/.temp/writeBookInfoFile`
  existsMkdir(testDistDir)

  const bookInfo = {
    author:'久保帶人',
    chapters:[{
      name: "0_第1話 死神&草莓",
      rawName: "第1話 死神&草莓",
      href: "https://www.fzmanga.com/user/page_direct?comic_id=sishenjingjie-jiubaodairen&section_slot=0&chapter_slot=0",
      imageList: [],
      imageListPath: [],
      index: 0
    },
    {
      name: "1_第2話 始發者",
      rawName: "第2話 始發者",
      href: "https://www.fzmanga.com/user/page_direct?comic_id=sishenjingjie-jiubaodairen&section_slot=0&chapter_slot=1",
      imageList: [],
      imageListPath: [],
      index: 1
    }],
    coverPath: '',
    coverUrl:'https://static-tw.baozimh.com/cover/sishenjingjie-jiubaodairen.jpg?w=285&h=375&q=100',
    desc:'看似暴力單薄，實則善良勇敢、愛護家庭的少年黑崎一護，擁有能看見靈的體質。直到遇見了死神•朽木露琪亞後，他身邊的一切事物開始了翻天覆地的變化。',
    name:'死神/境·界',
    pathName: '死神_境·界',
    url: 'https://tw.baozimh.com/comic/sishenjingjie-jiubaodairen',
    language: '',
    rawUrl: 'https://www.baozimh.com/comic/sishenjingjie-jiubaodairen'
  }
  await writeBookInfoFile(bookInfo, testDistDir)
  test('exits bookInfo.json', () => {
    expect(existsSync(`${testDistDir}/bookInfo.json`)).toBe(true)
  })
  test('bookInfo.json content', () => {
    expect(readFileSync(`${testDistDir}/bookInfo.json`, {encoding: 'utf-8'})).toBe(JSON.stringify(bookInfo, null, 2))
  })
  test('exits cover image', () => {
    expect(existsSync(`${testDistDir}/cover.jpg`)).toBe(true)
  })
})

describe('scan folder', () => {
  let testDistDir = `${__dirname}/.temp/scanFolder/`

  test('normal', async () => {
    testDistDir = `${testDistDir}/normal`
    const testDirA = `${testDistDir}/testA`
    const testDirB = `${testDistDir}/tetsB`
    existsMkdir(testDirA)
    existsMkdir(testDirB)
    const testABookInfo = {
      author:'AAA',
      chapters:[],
      coverPath: '',
      coverUrl:'',
      desc:'AAAAAA',
      name:'AAAA',
      url: ''
    }
    const testBBookInfo = {
      author:'BBB',
      chapters:[],
      coverPath: '',
      coverUrl:'',
      desc:'BBBB',
      name:'BBB',
      url: ''
    }
    writeFileSync(`${testDirA}/bookInfo.json`, JSON.stringify(testABookInfo, null, 2))
    writeFileSync(`${testDirB}/bookInfo.json`, JSON.stringify(testBBookInfo, null, 2))
    const bookInfoList = await scanFolder(testDistDir)
    expect(bookInfoList).toHaveLength(2)
    expect(bookInfoList[0]).toEqual(testABookInfo)
    expect(bookInfoList[1]).toEqual(testBBookInfo)
  })

  test('empty folder', async () => {
    testDistDir = `${testDistDir}/emptyFolder`
    existsMkdir(testDistDir)
    const bookInfoList = await scanFolder(testDistDir)
    expect(bookInfoList).toHaveLength(0)
  })

  test('file type', async () => {
    testDistDir = `${testDistDir}/fileType`
    existsMkdir(testDistDir)
    writeFileSync(`${testDistDir}/fileType.json`, JSON.stringify({}, null, 2))
    const bookInfoList = await scanFolder(testDistDir)
    expect(bookInfoList).toHaveLength(0)
  })
})