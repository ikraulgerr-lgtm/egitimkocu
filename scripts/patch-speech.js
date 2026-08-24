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
