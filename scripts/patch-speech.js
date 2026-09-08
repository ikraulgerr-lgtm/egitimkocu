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
  const fullPatchedSwift = `import Foundation
import Capacitor
import FirebaseCore
import FirebaseAuth
import GoogleSignIn

class GoogleAuthProviderHandler: NSObject {
    var pluginImplementation: FirebaseAuthentication

    init(_ pluginImplementation: FirebaseAuthentication) {
        self.pluginImplementation = pluginImplementation
        super.init()
    }

    func signIn(call: CAPPluginCall) {
        startSignInWithGoogleFlow(call, isLink: false)
    }

    func link(call: CAPPluginCall) {
        startSignInWithGoogleFlow(call, isLink: true)
    }

    func signOut() {
        GIDSignIn.sharedInstance.signOut()
    }

    private func startSignInWithGoogleFlow(_ call: CAPPluginCall, isLink: Bool) {
        guard let clientId = FirebaseApp.app()?.options.clientID else {
            let error = NSError(domain: "GoogleAuthProviderHandler", code: -1, userInfo: [NSLocalizedDescriptionKey: "FirebaseApp clientID is missing from GoogleService-Info.plist"])
            if isLink == true {
                self.pluginImplementation.handleFailedLink(message: "FirebaseApp clientID is missing", error: error)
            } else {
                self.pluginImplementation.handleFailedSignIn(message: "FirebaseApp clientID is missing", error: error)
            }
            return
        }
        let serverClientId = "576668557444-vkum7kn6aml5eoo07mi1a4o5ostpi3l9.apps.googleusercontent.com"
        let config = GIDConfiguration(clientID: clientId, serverClientID: serverClientId)
        GIDSignIn.sharedInstance.configuration = config

        DispatchQueue.main.async {
            guard let controller = self.pluginImplementation.getPlugin().bridge?.viewController ?? UIApplication.shared.windows.first(where: { $0.isKeyWindow })?.rootViewController ?? UIApplication.shared.windows.first?.rootViewController else {
                let error = NSError(domain: "GoogleAuthProviderHandler", code: -1, userInfo: [NSLocalizedDescriptionKey: "Root view controller is missing"])
                if isLink == true {
                    self.pluginImplementation.handleFailedLink(message: "Root view controller is missing", error: error)
                } else {
                    self.pluginImplementation.handleFailedSignIn(message: "Root view controller is missing", error: error)
                }
                return
            }
            let scopes = call.getArray("scopes", String.self) ?? []

            GIDSignIn.sharedInstance.signIn(withPresenting: controller, hint: nil, additionalScopes: scopes) { [weak self] result, error in
                guard let self = self else { return }
                if let error = error {
                    DispatchQueue.main.async {
                        if isLink == true {
                            self.pluginImplementation.handleFailedLink(message: error.localizedDescription, error: error)
                        } else {
                            self.pluginImplementation.handleFailedSignIn(message: error.localizedDescription, error: error)
                        }
                    }
                    return
                }

                guard let user = result?.user,
                      let idToken = user.idToken?.tokenString
                else {
                    let errMsg = "Google Sign-In: idToken is missing or nil."
                    let err = NSError(domain: "GoogleAuthProviderHandler", code: -1, userInfo: [NSLocalizedDescriptionKey: errMsg])
                    DispatchQueue.main.async {
                        if isLink == true {
                            self.pluginImplementation.handleFailedLink(message: errMsg, error: err)
                        } else {
                            self.pluginImplementation.handleFailedSignIn(message: errMsg, error: err)
                        }
                    }
                    return
                }
                let accessToken = user.accessToken.tokenString
                let serverAuthCode = result?.serverAuthCode
                let credential = GoogleAuthProvider.credential(withIDToken: idToken, accessToken: accessToken)
                DispatchQueue.main.async {
                    if isLink == true {
                        self.pluginImplementation.handleSuccessfulLink(credential: credential, idToken: idToken, nonce: nil,
                                                                       accessToken: accessToken, serverAuthCode: serverAuthCode, displayName: user.profile?.name, authorizationCode: nil)
                    } else {
                        self.pluginImplementation.handleSuccessfulSignIn(credential: credential, idToken: idToken, nonce: nil,
                                                                         accessToken: accessToken, displayName: user.profile?.name, authorizationCode: nil, serverAuthCode: serverAuthCode)
                    }
                }
            }
        }
    }
}
`;
  fs.writeFileSync(googleAuthHandlerFile, fullPatchedSwift, 'utf8');
  console.log('Patched GoogleAuthProviderHandler.swift with direct GoogleSignIn integration and serverClientID');
}
