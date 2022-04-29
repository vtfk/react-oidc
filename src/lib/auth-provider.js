import React, { useState, useEffect, useContext } from 'react'
import { UserManager } from 'oidc-client'
import { useSessionStorage } from './use-session-storage'

export const IDPortenContext = React.createContext()
export const useSession = () => useContext(IDPortenContext)

const defaultAuth = {
  isAuthenticated: false,
  user: false,
  token: false,
  idToken: false,
  expires: new Date().getTime(),
  authStatus: 'unknown',
  status: 'unknown'
}

export const IDPortenProvider = ({ children, config }) => {
  const [loginError, setLoginError] = useState(null)
  const [userManager] = useState(new UserManager(config))

  const sessionKey = 'IDPorten-AUTH'
  const preAllowedErrors = [
    'No matching state found in storage',
    'No state in response'
  ]
  const preferedSigninMethod = 'loginRedirect'
  const preferedSignoutMethod = 'logoutRedirect'

  const [auth, setAuth] = useSessionStorage(sessionKey, defaultAuth)

  const { isAuthenticated, token, user, idToken, authStatus, status } = auth

  function saveUserData (response) {
    const token = response.access_token
    const idToken = response.id_token
    const user = response.profile
    const expires = new Date(response.expires_at * 1000).getTime() // expires_at kommer i sekunder siden epoch, og new Date forventer at det skal være millisekunder
    const isAuthenticated = token && expires > new Date().getTime()
    const authStatus = 'finished'
    const status = 'finished'

    const newAuth = {
      isAuthenticated,
      token,
      user,
      idToken,
      expires,
      authStatus,
      status
    }

    setAuth(newAuth)
  }

  function setAuthObj (obj, rest = {}) {
    const authCopy = { ...auth, ...rest }
    setAuth({ ...authCopy, ...obj })
  }

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const signinResponse = await userManager.processSigninResponse()
        if (signinResponse) {
          saveUserData(signinResponse)
        } else {
          setAuthObj({ authStatus: 'finished', status: 'finished' })
        }
      } catch (error) {
        if (preAllowedErrors.includes(error.message)) {
          setAuthObj({ authStatus: 'finished', status: 'finished' })
        } else {
          setAuthObj({ authStatus: 'rejected', status: 'finished' })
          console.error('checkLogin error:', error)
          setLoginError(error)
        }
      }
    }

    const checkLogout = async () => {
      try {
        const signoutResponse = await userManager.processSignoutResponse()
        if (signoutResponse.error) {
          console.log('checkLogout Signout response error:', signoutResponse.error, signoutResponse.error_description)
        } else {
          setAuthObj(defaultAuth)
        }
      } catch (error) {
        setAuthObj({ authStatus: 'rejected', status: 'finished' })
        console.log('checkLogout Signout error:', error)
        setLoginError(error)
      }
    }

    setAuthObj({ authStatus: 'pending' })
    if (status === 'loginPending') {
      checkLogin()
    } else if (status === 'logoutPending') {
      checkLogout()
    } else {
      setAuthObj({ authStatus: 'finished' })
    }
  }, []) // eslint-disable-line

  const login = async (method = preferedSigninMethod) => {
    if (method === 'loginPopup') {
      try {
        // TODO: Doesn't work!!
        const user = await userManager.signinPopup()
        await userManager.signinPopupCallback()
        saveUserData(user)
      } catch (error) {
        console.error('login/popup:', error)
        setLoginError(error)
      }
    } else if (method === 'loginRedirect') {
      try {
        setAuthObj({ status: 'loginPending' })
        await userManager.signinRedirect()
      } catch (error) {
        console.error('login/redirect', error)
        setLoginError(error)
      }
    }
  }

  const logout = async (method = preferedSignoutMethod) => {
    if (method === 'logoutPopup') {
      try {
        // TODO: Doesn't work!!
        await userManager.signoutPopup()
      } catch (error) {
        console.error('logout/popup', error)
        setLoginError(error)
      }
    } else if (method === 'logoutRedirect') {
      try {
        setAuthObj({ status: 'logoutPending' })
        await userManager.signoutRedirect()
      } catch (error) {
        console.error('logout/redirect', error)
        setLoginError(error)
      }
    }
  }

  return (
    <IDPortenContext.Provider
      value={{
        isAuthenticated,
        authStatus,
        token,
        user,
        idToken,
        loginError,
        login,
        logout
      }}
    >
      {children}
    </IDPortenContext.Provider>
  )
}
