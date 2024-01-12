import fs from 'node:fs'

export * from './log'
export * from './ua'

export function fixPathName(path: string) {
  if (!path) return ''
  const dirNameReg = /[\\/:*?"<>|\n\r]/g
  return path.replace(dirNameReg, '_').replace(/\s/g, '')
}

export function existsMkdir(path: string) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, {recursive: true})
  }
}

export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined
}

export function getUrlFileName(url: string) {
  if (!url) return ''
  const urlObj = new URL(url)
  return urlObj.pathname.split('/').at(-1)
}

export function toReversed<T = any>(arr: T[]) {
  const newArr: T[] = []
  arr.forEach(item => newArr.unshift(item))
  return newArr
}

export function sleep(seconds: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true)
    }, seconds)
  })
}