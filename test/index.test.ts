import { expect, test, describe } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { existsMkdir, fixPathName, getImageName, getImgList, parseBookInfo, saveImg, saveImgList, writeBookInfoFile } from '../src'

describe('test exist mkdir', () => {
  const randNumber = Math.floor(Math.random()*1000000)
  const testDistDir = `${__dirname}/.temp/existsMkdir/${randNumber}`

  test('normal mkdir', () => {
    existsMkdir(testDistDir)
    expect(existsSync(testDistDir)).toBeTruthy()
    expect(() => existsMkdir(testDistDir)).not.toThrowError('EEXIST: file already exists')
  })

})


test('saveImgList', async () => {
  const imgList = [
    'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/1.jpg',
    'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/2.jpg',
    'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/3.jpg',
    'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/4.jpg',
    'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/5.jpg',
    'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/6.jpg'
  ]
  const testDistDir = `${__dirname}/.temp/saveImgList`
  existsMkdir(testDistDir)
  await saveImgList(testDistDir, imgList)
  imgList.forEach(url => {
    expect(existsSync(`${testDistDir}/${getImageName(url)}`)).toBe(true)
  })
})

// test('getImageName', () => {
//   const url =  'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/1.jpg'
//   const fileName = url.split('/').at(-1)
//   expect(fileName).toBe('1.jpg')
// })

test('saveImg', async () => {
  const testDistDir = `${__dirname}/.temp/saveImg`

  existsMkdir(testDistDir)
  const imgUrl = 'https://s1.baozicdn.com/scomic/sishenjingjie-jiubaodairen/0/0-ai3o/1.jpg'
  await saveImg(testDistDir, imgUrl)
  const data = readFileSync(`${testDistDir}/${getImageName(imgUrl)}`)
  expect(data).toMatchSnapshot()
})


describe('parse', () => {
  test('parse Info', async () => {
    const bookInfo = await parseBookInfo('https://www.fzmanga.com/comic/sishenjingjie-jiubaodairen')
    expect.soft(bookInfo.name).toBeTruthy()
    expect.soft(bookInfo.author).toBeTruthy()
    expect.soft(bookInfo.coverUrl).toBeTruthy()
    expect.soft(bookInfo.desc).toBeTruthy()
    expect.soft(bookInfo.chapters.length).toBeGreaterThan(0)
  })
})

describe('get image list', () => {
  test('normal', async () => {
    const url = 'https://www.fzmanga.com/comic/chapter/sishenjingjie-jiubaodairen/0_0.html'
    const imgList = await getImgList(url)
    expect(imgList.length).toBe(6)
  })

  test('http 302 state', async () => {
    const url = 'https://www.fzmanga.com/user/page_direct?comic_id=sishenjingjie-jiubaodairen&section_slot=0&chapter_slot=0'
    const imgList = await getImgList(url)
    expect(imgList.length).toBe(6)
  })

  test('paging', async () => {
    const url = 'https://www.fzmanga.com/comic/chapter/congdashukaishidejinhua-feihongzhiyeyuanzhuheiniaoshe/0_0.html'
    const imgList = await getImgList(url)
    expect(imgList.length).toBe(166)
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

describe('fixPathName', () => {
  test('path _', () => {
    expect(fixPathName('a/b/c')).toBe('a_b_c')
  })
  test('path \s', () => {
    expect(fixPathName(' a/b/c ')).toBe('a_b_c')
  })
})

describe('writeBookInfoFile', async () => {
  const testDistDir = `${__dirname}/.temp/writeBookInfoFile`
  existsMkdir(testDistDir)

  const bookInfo = {
    author:'久保帶人',
    chapters:[{
      name: "第1話 死神&草莓",
      href: "https://www.fzmanga.com/user/page_direct?comic_id=sishenjingjie-jiubaodairen&section_slot=0&chapter_slot=0",
      imageList: [],
      imageListPath: []
    },
    {
      name: "第2話 始發者",
      href: "https://www.fzmanga.com/user/page_direct?comic_id=sishenjingjie-jiubaodairen&section_slot=0&chapter_slot=1",
      imageList: [],
      imageListPath: []
    }],
    coverPath: '',
    coverUrl:'https://static-tw.baozimh.com/cover/sishenjingjie-jiubaodairen.jpg?w=285&h=375&q=100',
    desc:'看似暴力單薄，實則善良勇敢、愛護家庭的少年黑崎一護，擁有能看見靈的體質。直到遇見了死神•朽木露琪亞後，他身邊的一切事物開始了翻天覆地的變化。',
    name:'死神/境·界'
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