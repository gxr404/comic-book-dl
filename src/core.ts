import path from 'node:path'
import pLimit from 'p-limit'
import ProgressBar from './lib/ProgressBar'
import type { IProgressItem } from './lib/ProgressBar'
import { existsMkdir } from './utils'
import { matchParse } from './lib/parse/index'
import { writeBookInfoFile } from './lib/download'
import type { ChaptersItem } from './lib/parse/base'

interface RunHooks {
  // 漫画url解析错误
  parseErr?: () => void,
  // 下载中断
  downloadInterrupted?: () => void,
  // 开始下载
  start?: (bookName: string) => void,
  // 下载结束存在错误
  error?: (bookName: string, chaptersList: ChaptersItem[], errorList: ErrorChapterItem[]) => void,
  // 下载结束 成功未有错误
  success?: (bookName: string, distPath: string, chaptersList: ChaptersItem[] | null) => void,
}

export interface ErrorChapterItem {
  bookName: string,
  /** 图片获取失败则所有图片都算失败 无指定的图片 */
  imgUrl?: string,
  chapter:  ChaptersItem
}

interface IgnoreBook {
  name: string,
  chapter?: string[]
}

export interface UserConfig {
  ignore?: IgnoreBook[]
}
export interface Config {
  bookPath: string,
  targetUrl: string,
  ignoreConsole?: boolean,
  userConfig?: UserConfig
}

// process.on('warning', e => {
//   writeFile('./warn.log', JSON.stringify(e.stack, null, 2))
//   console.warn(e.stack?.at(-1))
// })

export async function run(config: Config, hooks: RunHooks) {
  const match = matchParse(config.targetUrl)
  if (!match) {
    if (hooks.parseErr) hooks.parseErr()
    return
  }
  const { preHandleUrl, getInstance } = match
  if (typeof preHandleUrl === 'function') {
    config.targetUrl = preHandleUrl(config.targetUrl)
  }
  const parseInstance = getInstance(config.targetUrl)
  const bookInfo = await parseInstance.parseBookInfo()
  if (!bookInfo) {
    if (hooks.parseErr) hooks.parseErr()
    return
  }

  const bookName = bookInfo.name
  const bookDistPath = path.resolve(config.bookPath, bookInfo.pathName)
  existsMkdir(bookDistPath)

  const total = bookInfo.chapters.length
  const progressBar = new ProgressBar(bookDistPath, total, config.ignoreConsole)
  await progressBar.init()

  // 已完成 无需再继续
  if (progressBar.curr === total) {
    if (hooks.success) hooks.success(bookName, bookDistPath, null)
    return
  }

  let chaptersList = bookInfo.chapters

  // 存在用户配置 忽略本漫画的某些章节
  if (config.userConfig?.ignore) {
    const ignoreInfo = config.userConfig?.ignore.find(item => item.name === bookName)
    if (ignoreInfo) {
      const ignoreChapter = ignoreInfo.chapter ?? []
      chaptersList = chaptersList.filter(chaptersItem => {
        return !ignoreChapter.includes(chaptersItem.name)
      })
      // 已完成 无需再继续
      if (progressBar.curr === total - ignoreChapter.length) {
        if (hooks.success) {
          progressBar.bar?.stop()
          hooks.success(bookName, bookDistPath, null)
        }
        return
      }
    }
  }

  if (hooks.start) hooks.start(bookName)


  // 下载中断 重新获取下载进度数据
  if (progressBar.isDownloadInterrupted) {
    if (hooks.downloadInterrupted) hooks?.downloadInterrupted()
    // 根据匹配chaptersList 重新更新 progressInfo 仅保留符合chaptersList
    // 因为有种情况 漫画更新 url一致 但对应的内容由于更新变化了
    const updateProgressInfo: IProgressItem[] = []

    // 从process.json中读取已下载的数据 对 chaptersList 回填 已下载的数据
    // 并过滤出 chaptersList中未下载的
    chaptersList = chaptersList.filter((chaptersItem) => {
      return !progressBar.progressInfo.some(item => {
        const isSameHref = item.href === chaptersItem.href
        const isSameName = item.rawName == chaptersItem.rawName
        if (isSameHref && isSameName) {
          chaptersItem.imageList = item.imageList
          chaptersItem.imageListPath = item.imageListPath
          updateProgressInfo.push(item)
        }
        return isSameHref && isSameName
      })
    })
    // ! 漫画更新 url一致 但对应的内容由于更新变化了 重新更新符合的progressInfo
    progressBar.resetProgressInfo(updateProgressInfo)
  }

  const LIMIT_MAX = 6

  const limit = pLimit(LIMIT_MAX)

  const errorList: ErrorChapterItem[] = []

  const promiseList = chaptersList.map(item => {
    return limit(async () => {
      const chaptersItemPath = `${bookDistPath}/chapters/${item.name}`
      existsMkdir(chaptersItemPath)
      let getImageListSuccess = true
      const imageList = await parseInstance.getImgList(item.href)
        .catch(() => {
          getImageListSuccess = false
          errorList.push({
            bookName,
            chapter: item
          })
          return [] as string[]
        })
      let imageListPath: string[] = []
      const curBar = progressBar.multiBarCreate({
        total: imageList.length,
        file: `下载「${item.name}」中的图片...`
      })

      let isAllSuccess = true
      imageListPath = await parseInstance.saveImgList(
        chaptersItemPath,
        imageList,
        (imgUrl: string, isSuccess: boolean) => {
          if (!isSuccess) {
            isAllSuccess = false
            errorList.push({
              bookName,
              imgUrl,
              chapter: item
            })
          }
          progressBar.multiBarUpdate(curBar)
        }
      )
      imageListPath = imageListPath.map((itemPath) => {
        return `chapters/${item.name}/${itemPath}`
      })
      item.imageList = imageList
      item.imageListPath = imageListPath
      progressBar.multiBarRemove(curBar)
      await progressBar.updateProgress({
        name: item.name,
        rawName: item.rawName,
        path: chaptersItemPath,
        href: item.href,
        index: item.index,
        imageList,
        imageListPath
      }, isAllSuccess && getImageListSuccess)
      return isAllSuccess && getImageListSuccess
    })
  })

  const isAllSuccess = await Promise.all(promiseList)

  await writeBookInfoFile(bookInfo, bookDistPath, parseInstance)

  if (errorList.length > 0) {
    if (hooks.error) hooks.error(bookName, chaptersList, errorList)
  } else if (progressBar.curr === total && isAllSuccess) {
    if (hooks.success) hooks.success(bookName, bookDistPath, chaptersList)
  }
}
