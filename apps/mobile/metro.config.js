// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Caminho absoluto do build CJS do zustand (mesmo arquivo usado no
// iOS/Android via a condição "react-native" do package.json do pacote).
const zustandCjsEntry = path.join(
  path.dirname(require.resolve('zustand/package.json')),
  'index.js',
);

// O pacote @prodscore/shared escreve imports relativos com extensão
// ".js" (convenção do moduleResolution "NodeNext" usada pela API/tsc),
// mas o resolver do Metro não faz o fallback ".js" -> ".ts"/".tsx" que
// Vite e tsx fazem automaticamente. Sem isso, o bundler falha ao montar
// o app com "Unable to resolve module ... /types/index.js".
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = originalResolveRequest ?? context.resolveRequest;

  // No target "web", o Metro usa a condição "browser" do package.json do
  // zustand, que aponta pro build ESM (contém `import.meta.env` — sintaxe
  // que só é válida dentro de um <script type="module">, e o Metro serve
  // um script clássico). O build CJS ("main") não usa import.meta e é o
  // mesmo já usado normalmente no iOS/Android via a condição "react-native".
  if (platform === 'web' && moduleName === 'zustand') {
    return { type: 'sourceFile', filePath: zustandCjsEntry };
  }

  try {
    return resolve(context, moduleName, platform);
  } catch (error) {
    if (moduleName.endsWith('.js')) {
      return resolve(context, moduleName.slice(0, -3), platform);
    }
    throw error;
  }
};

module.exports = config;
