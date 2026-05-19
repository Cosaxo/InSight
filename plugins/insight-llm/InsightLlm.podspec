require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'InsightLlm'
  s.version = package['version']
  s.summary = package['description']
  s.license = 'MIT'
  s.homepage = 'https://github.com/cosaxo/insight'
  s.author = 'Cosaxo'
  s.source = { :git => 'https://github.com/cosaxo/insight.git', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target = '14.0'
  s.dependency 'Capacitor'
  # MediaPipe GenAI — wraps the C++ inference runtime + LiteRT for
  # on-device Gemma 3n inference. Supports multimodal (image+text)
  # input via addImage() / generateResponseAsync().
  s.dependency 'MediaPipeTasksGenai', '~> 0.10'
  s.swift_version = '5.9'
end
