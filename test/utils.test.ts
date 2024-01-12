import { expect, test, describe } from 'vitest'
import { existsSync } from 'node:fs'
import { existsMkdir, fixPathName, getUrlFileName } from '@/utils'

describe('test exist mkdir', () => {
  const randNumber = Math.floor(Math.random()*1000000)
  const testDistDir = `${__dirname}/.temp/existsMkdir/${randNumber}`

  test('normal mkdir', () => {
    existsMkdir(testDistDir)
    expect(existsSync(testDistDir)).toBeTruthy()
    expect(() => existsMkdir(testDistDir)).not.toThrowError('EEXIST: file already exists')
  })

})

test('getUrlFileName', () => {
  const url =  'https://xxx/1.jpg?a=1&b=2#123'
  expect(getUrlFileName(url)).toBe('1.jpg')
})

describe('fixPathName', () => {
  test('path _', () => {
    expect(fixPathName('a/b/c')).toBe('a_b_c')
  })
  test('path \\s', () => {
    expect(fixPathName(' a/b/c ')).toBe('a_b_c')
  })
})
