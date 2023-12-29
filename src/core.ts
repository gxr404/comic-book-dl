import path from 'node:path'
import pLimit from 'p-limit'
import ProgressBar from './lib/ProgressBar'
import { fixPathName, existsMkdir } from './utils'
import { parseBookInfo, getImgList } from './lib/parse'
import { saveImgList, writeBookInfoFile } from './lib/download'
import type { ChaptersItem } from './lib/parse'

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
  imgUrl: string,
  chapter:  ChaptersItem
}

export interface Config {
  bookPath: string,
  targetUrl: string;
}

export async function run(config: Config, hooks: RunHooks) {
  const bookInfo = await parseBookInfo(config.targetUrl)
  if (!bookInfo) {
    if (hooks.parseErr) hooks.parseErr()
    return
  }

  const bookName = bookInfo.name
  const bookDistPath = path.resolve(config.bookPath, fixPathName(bookInfo.name))
  existsMkdir(bookDistPath)

  const total = bookInfo.chapters.length
  const progressBar = new ProgressBar(bookDistPath, total)
  await progressBar.init()

  // 已完成 无需再继续
  if (progressBar.curr === total) {
    if (progressBar.bar) progressBar.bar.stop()
    if (hooks.success) hooks.success(bookName, bookDistPath, null)
    return
  }

  if (hooks.start) hooks.start(bookName)

  let chaptersList = bookInfo.chapters

  // 下载中断 重新获取下载进度数据
  if (progressBar.isDownloadInterrupted) {
    if (hooks.downloadInterrupted) hooks?.downloadInterrupted()
    // 从process.json中读取已下载的数据 对 chaptersList 回填 已下载的数据
    // 并过滤出 chaptersList中未下载的
    chaptersList = chaptersList.filter((chaptersItem) => {
      return !progressBar.progressInfo.some(item => {
        const isSameHref = item.href === chaptersItem.href
        const isSameName = item.rawName == chaptersItem.rawName
        if (isSameHref && isSameName) {
          chaptersItem.imageList = item.imageList
          chaptersItem.imageListPath = item.imageListPath
        }
        return isSameHref && isSameName
      })
    })
  }

  const LIMIT_MAX = 10

  const limit = pLimit(LIMIT_MAX)

  const errorList: ErrorChapterItem[] = []

  const promiseList = chaptersList.map(item => {
    return limit(async () => {
      const chaptersItemPath = `${bookDistPath}/chapters/${item.name}`
      existsMkdir(chaptersItemPath)
      const imageList = await getImgList(item.href)
      let imageListPath: string[] = []
      const curBar = progressBar.multiBar!.create(imageList.length, 0, {
        file: `下载「${item.name}」中的图片...`
      })

      let isAllSuccess = true
      imageListPath = await saveImgList(
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
          curBar.increment()
        }
      )
      imageListPath = imageListPath.map((itemPath) => {
        return `chapters/${item.name}/${itemPath}`
      })
      item.imageList = imageList
      item.imageListPath = imageListPath
      progressBar.multiBar!.remove(curBar)
      await progressBar.updateProgress({
        name: item.name,
        rawName: item.rawName,
        path: chaptersItemPath,
        href: item.href,
        index: item.index,
        imageList,
        imageListPath
      }, isAllSuccess)
      return isAllSuccess
    })
  })

  const isAllSuccess = await Promise.all(promiseList)

  await writeBookInfoFile(bookInfo, bookDistPath)

  if (errorList.length > 0) {
    if (hooks.error) hooks.error(bookName, chaptersList, errorList)
  } else if (progressBar.curr === total && isAllSuccess) {
    if (hooks.success) hooks.success(bookName, bookDistPath, chaptersList)
  }
}
