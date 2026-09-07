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
#if RGCFA_INCLUDE_GOOGLE
import GoogleSignIn
#endif

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
        #if RGCFA_INCLUDE_GOOGLE
        GIDSignIn.sharedInstance.signOut()
        #endif
    }

    private func startSignInWithGoogleFlow(_ call: CAPPluginCall, isLink: Bool) {
        #if RGCFA_INCLUDE_GOOGLE
        guard let clientId = FirebaseApp.app()?.options.clientID else {
            let error = NSError(domain: "GoogleAuthProviderHandler", code: -1, userInfo: [NSLocalizedDescriptionKey: "FirebaseApp clientID is missing"])
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
        guard let controller = self.pluginImplementation.getPlugin().bridge?.viewController else {
            let error = NSError(domain: "GoogleAuthProviderHandler", code: -1, userInfo: [NSLocalizedDescriptionKey: "View controller is missing"])
            if isLink == true {
                self.pluginImplementation.handleFailedLink(message: "View controller is missing", error: error)
            } else {
                self.pluginImplementation.handleFailedSignIn(message: "View controller is missing", error: error)
            }
            return
        }
        let scopes = call.getArray("scopes", String.self) ?? []

        DispatchQueue.main.async {
            GIDSignIn.sharedInstance.signIn(withPresenting: controller, hint: nil, additionalScopes: scopes) { [unowned self] result, error in
                if let error = error {
                    if isLink == true {
                        self.pluginImplementation.handleFailedLink(message: nil, error: error)
                    } else {
                        self.pluginImplementation.handleFailedSignIn(message: nil, error: error)
                    }
                    return
                }

                guard let user = result?.user,
                      let idToken = user.idToken?.tokenString
                else {
                    let errMsg = "Google Sign-In: idToken is missing or nil."
                    let error = NSError(domain: "GoogleAuthProviderHandler", code: -1, userInfo: [NSLocalizedDescriptionKey: errMsg])
                    if isLink == true {
                        self.pluginImplementation.handleFailedLink(message: errMsg, error: error)
                    } else {
                        self.pluginImplementation.handleFailedSignIn(message: errMsg, error: error)
                    }
                    return
                }
                let accessToken = user.accessToken.tokenString
                let serverAuthCode = result?.serverAuthCode
                let credential = GoogleAuthProvider.credential(withIDToken: idToken, accessToken: accessToken)
                if isLink == true {
                    self.pluginImplementation.handleSuccessfulLink(credential: credential, idToken: idToken, nonce: nil,
                                                                   accessToken: accessToken, serverAuthCode: serverAuthCode, displayName: nil, authorizationCode: nil)
                } else {
                    self.pluginImplementation.handleSuccessfulSignIn(credential: credential, idToken: idToken, nonce: nil,
                                                                     accessToken: accessToken, displayName: nil, authorizationCode: nil, serverAuthCode: serverAuthCode)
                }
            }
        }
        #else
        let error = NSError(domain: "GoogleAuthProviderHandler", code: -1, userInfo: [NSLocalizedDescriptionKey: "Google Sign-In provider not compiled into app (RGCFA_INCLUDE_GOOGLE)."])
        if isLink == true {
            self.pluginImplementation.handleFailedLink(message: "Google Sign-In provider not compiled into app.", error: error)
        } else {
            self.pluginImplementation.handleFailedSignIn(message: "Google Sign-In provider not compiled into app.", error: error)
        }
        #endif
    }
}
`;
  fs.writeFileSync(googleAuthHandlerFile, fullPatchedSwift, 'utf8');
  console.log('Patched GoogleAuthProviderHandler.swift with full error handling and serverClientID');
}
