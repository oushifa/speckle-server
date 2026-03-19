const config = {
  DUI_REDIRECT_URL: 'http://47.100.77.97:64483'
}

const getConfig = (key: keyof typeof config) => config[key].replace(/\/$/, '')

export default getConfig
