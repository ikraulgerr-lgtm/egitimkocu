import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'node_modules', '@capacitor-community', 'speech-recognition', 'android', 'build.gradle');
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace("compileSdk project.hasProperty('compileSdkVersion')", "compileSdkVersion project.hasProperty('compileSdkVersion')");
  content = content.replace("proguard-android.txt", "proguard-android-optimize.txt");
  fs.writeFileSync(file, content, 'utf8');
  console.log('Patched speech-recognition build.gradle for Gradle 9');
}

const googleAuthHandlerFile = path.join(process.cwd(), 'node_modules', '@capacitor-firebase', 'authentication', 'ios', 'Plugin', 'Handlers', 'GoogleAuthProviderHandler.swift');
if (fs.existsSync(googleAuthHandlerFile)) {
  let content = fs.readFileSync(googleAuthHandlerFile, 'utf8');
  content = content.replace(
    'let config = GIDConfiguration(clientID: clientId, serverClientID: clientId)',
    'let serverClientId = "576668557444-vkum7kn6aml5eoo07mi1a4o5ostpi3l9.apps.googleusercontent.com"\n        let config = GIDConfiguration(clientID: clientId, serverClientID: serverClientId)'
  );
  content = content.replace(
    'guard let user = result?.user,\n                      let idToken = user.idToken?.tokenString\n                else {\n                    return\n                }',
    'guard let user = result?.user,\n                      let idToken = user.idToken?.tokenString\n                else {\n                    let errMsg = "Google Sign-In: idToken is missing or nil."\n                    let error = NSError(domain: "GoogleAuthProviderHandler", code: -1, userInfo: [NSLocalizedDescriptionKey: errMsg])\n                    if isLink == true {\n                        self.pluginImplementation.handleFailedLink(message: errMsg, error: error)\n                    } else {\n                        self.pluginImplementation.handleFailedSignIn(message: errMsg, error: error)\n                    }\n                    return\n                }'
  );
  fs.writeFileSync(googleAuthHandlerFile, content, 'utf8');
  console.log('Patched GoogleAuthProviderHandler.swift for iOS serverClientID and error handling');
}
