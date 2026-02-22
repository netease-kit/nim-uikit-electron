// Vetur 配置文件
// https://vuejs.github.io/vetur/guide/setup.html

module.exports = {
  // 指定 TypeScript 配置文件路径
  settings: {
    "vetur.useWorkspaceDependencies": true,
    "vetur.experimental.templateInterpolationService": true
  },
  // 指定项目配置
  projects: [
    {
      // 项目根目录
      root: './',
      // 指定 package.json 路径
      package: './package.json',
      // 指定 tsconfig.json 路径
      tsconfig: './tsconfig.json',
      // 全局组件路径
      globalComponents: [
        './src/components/**/*.vue'
      ]
    }
  ]
}
