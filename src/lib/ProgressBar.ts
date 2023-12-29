import fs from 'node:fs/promises'
import cliProgress from 'cli-progress'
import { rimraf } from 'rimraf'

export interface IProgressItem {
  name: string,
  rawName: string,
  index: number,
  path: string,
  href: string,
  imageList: string[],
  imageListPath: string[]
}
export type IProgress = IProgressItem[]

export default class ProgressBar {
  bookPath: string = ''
  progressFilePath: string = ''
  progressInfo: IProgress = []
  curr: number = 0
  total: number = 0
  /** 是否中断下载 */
  isDownloadInterrupted: boolean = false
  multiBar: cliProgress.MultiBar | null = null
  bar: cliProgress.SingleBar | null = null
  completePromise: Promise<void> | null = null

  constructor (bookPath: string, total: number) {
    this.bookPath = bookPath
    this.progressFilePath = `${bookPath}/progress.json`
    this.total = total
  }

  async init() {
    this.progressInfo = await this.getProgress()
    this.curr = this.progressInfo.length

    if (this.curr === this.total) return

    this.isDownloadInterrupted = this.curr > 0 && this.curr !== this.total

    this.multiBar = new cliProgress.MultiBar({
      format: ' {bar} | {file} | {value}/{total}',
      hideCursor: true,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      clearOnComplete: true,
      stopOnComplete: true,
      noTTYOutput: true
    })

    this.bar = this.multiBar.create(this.total, this.curr, {}, {
      ...cliProgress.Presets.legacy,
      format: 'Download [{bar}] {percentage}% | {value}/{total}',
    })
  }

  async getProgress(): Promise<IProgress> {
    let progressInfo = []
    try {
      const progressInfoStr = await fs.readFile(this.progressFilePath, {encoding: 'utf8'})
      progressInfo = JSON.parse(progressInfoStr)
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        await fs.writeFile(
          this.progressFilePath,
          JSON.stringify(progressInfo),
          {encoding: 'utf8'}
        )
      }
    }
    return progressInfo
  }

  async updateProgress(progressItem: IProgressItem, isSuccess: boolean) {
    this.curr = this.curr + 1
    // 成功才写入 progress.json 以便重新执行时重新下载
    if (isSuccess) {
      this.progressInfo.push(progressItem)
      await fs.writeFile(
        this.progressFilePath,
        JSON.stringify(this.progressInfo, null, 2),
        {encoding: 'utf8'}
      )
    }
    if (this.bar) {
      this.bar.update(this.curr > this.total ? this.total : this.curr)
      if (this.curr >= this.total) {
        this.clearLine(1)
        this.bar.render()
        this.bar.stop()
        console.log('')
      }
    }
  }

  async resetProgressInfo(updateProgressInfo: IProgressItem[]) {
    if (updateProgressInfo.length < this.progressInfo.length) {
      const needDeleteList = this.progressInfo.filter((oldData) => {
        return !updateProgressInfo.some(item => {
          return item.href == oldData.href &&
            item.name === oldData.name &&
            item.rawName === oldData.rawName
        })
      })
      this.progressInfo = updateProgressInfo
      this.bar!.update(updateProgressInfo.length)
      this.curr = updateProgressInfo.length
      // 删除已下载但已经不符合最新漫画目录的文件夹
      const promiseList = needDeleteList.map(needDel => {
        return rimraf(needDel.path, {preserveRoot: true})
      })
      await Promise.all(promiseList)
    }

  }

  // 暂停进度条的打印
  pause () {
    if (this.bar) this.bar.stop()
  }
  // 继续进度条的打印
  continue(line: number) {
    this.clearLine(line)
    this.bar?.start(this.total, this.curr)
  }
  // 清理n行终端显示
  clearLine(line: number) {
    if (line <= 0) return
    process.stderr.cursorTo(0)
    for (let i = 0; i< line;i++){
      process.stderr.moveCursor(0, -1)
      process.stderr.clearLine(1)
    }
  }
}