/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, no-unused-vars, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   standard/array-bracket-even-spacing, object-curly-newline, no-void, quotes, no-unreachable */

const konfig = {
  contentScript: 'https://beefx.mork.work/js/youtube/beefxt-main-esm.js',
  styles: [
    'https://beefx.mork.work/css/beefx.css',
    'https://beefx.mork.work/css/beefxt.css',
    'https://fonts.googleapis.com/css2?family=Roboto+Condensed:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&display=swap'
  ]
}

const injectCss = filenameUrl => {  
  const resource = filenameUrl.split('/').slice(-1)[0]
  
  const leafStyle = document.createElement('link')
  leafStyle.setAttribute('href', filenameUrl)
  leafStyle.setAttribute('rel', 'stylesheet')
  leafStyle.setAttribute('class', resource + '-tunnex')
  leafStyle.async = true
  document.head.appendChild(leafStyle)
}

const injectContentScript = contentScript => {
  const script = document.createElement('script')
  script.setAttribute('type', 'module')
  script.src = contentScript
  script.async = true
  document.head.insertAdjacentElement('afterbegin', script)
}

const onReadyState = _ => new Promise(resolve => document.getElementsByTagName('head').length
  ? resolve()
  : document.addEventListener('readystatechange', _ => {
    if (document.readyState === 'interactive' || document.readyState === 'complete') {          
      resolve()
    }
  })
)

//%Autoinit

onReadyState().then(_ => {
  console.log('injecting content script', konfig.contentScript)
  injectContentScript(konfig.contentScript)
  console.log('injecting styles', konfig.styles)
  for (const style of konfig.styles) {
    injectCss(style)
  }
})
