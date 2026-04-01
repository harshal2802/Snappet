import { Worker, Viewer, SpecialZoomLevel } from '@react-pdf-viewer/core'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout'
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation'
import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css'

import { useEffect, useImperativeHandle, forwardRef } from 'react'
import { useDarkMode } from '../../hooks/useDarkMode'
import type { OcrWord } from './types'

const WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'

export interface PdfViewerPaneHandle {
  jumpToPage: (pageIndex: number) => void
}

interface PdfViewerPaneProps {
  fileData: Uint8Array
  fileName: string
  activeWord: OcrWord | null
}

const PdfViewerPane = forwardRef<PdfViewerPaneHandle, PdfViewerPaneProps>(
  ({ fileData, fileName, activeWord }, ref) => {
    const { isDark } = useDarkMode()

    const pageNavPlugin = pageNavigationPlugin()
    const { jumpToPage } = pageNavPlugin

    useImperativeHandle(ref, () => ({
      jumpToPage: (pageIndex: number) => jumpToPage(pageIndex),
    }))

    // Jump to active word's page when it changes
    useEffect(() => {
      if (activeWord !== null) {
        jumpToPage(activeWord.bbox.pageIndex)
      }
    }, [activeWord, jumpToPage])

    const defaultLayout = defaultLayoutPlugin()

    return (
      <div className="flex flex-col h-full">
        {/* File name bar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <span className="text-sm">📄</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{fileName}</span>
        </div>

        {/* Viewer */}
        <div className="flex-1 overflow-hidden" style={{ height: 'calc(100% - 36px)' }}>
          <Worker workerUrl={WORKER_URL}>
            <Viewer
              fileUrl={fileData}
              plugins={[defaultLayout, pageNavPlugin]}
              theme={isDark ? 'dark' : 'light'}
              defaultScale={SpecialZoomLevel.PageWidth}
              renderLoader={(percentages) => (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-48 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-200"
                      style={{ width: `${Math.round(percentages)}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Loading… {Math.round(percentages)}%
                  </p>
                </div>
              )}
            />
          </Worker>
        </div>
      </div>
    )
  }
)

PdfViewerPane.displayName = 'PdfViewerPane'

export default PdfViewerPane
