import {
  AuthSessionOptions,
  makeRedirectUri,
  revokeAsync,
  startAsync,
} from "expo-auth-session";
import React, {
  useEffect,
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";
import { generateRandom } from "expo-auth-session/build/PKCE";

import { api } from "../services/api";
import { Alert } from "react-native";

interface User {
  id: number;
  display_name: string;
  email: string;
  profile_image_url: string;
}

interface AuthContextData {
  user: User;
  isLoggingOut: boolean;
  isLoggingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProviderData {
  children: ReactNode;
}

const AuthContext = createContext({} as AuthContextData);

const twitchEndpoints = {
  authorization: "https://id.twitch.tv/oauth2/authorize",
  revocation: "https://id.twitch.tv/oauth2/revoke",
};

function AuthProvider({ children }: AuthProviderData) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState({} as User);
  const [userToken, setUserToken] = useState("");

  const CLIENT_ID = process.env.CLIENT_ID;
  async function signIn() {
    try {
      setIsLoggingIn(true);
      const REDIRECT_URI = makeRedirectUri({ useProxy: true });
      const RESPONSE_TYPE = "token";
      const SCOPE = encodeURI("openid user:read:email user:read:follows");
      const FORCE_VERIFY = true;
      const STATE = generateRandom(30);
      const authUrl =
        twitchEndpoints.authorization +
        `?client_id=${CLIENT_ID}` +
        `&redirect_uri=${REDIRECT_URI}` +
        `&response_type=${RESPONSE_TYPE}` +
        `&scope=${SCOPE}` +
        `&force_verify=${FORCE_VERIFY}` +
        `&state=${STATE}`;

      const result = await startAsync({ authUrl });

      // verify if startAsync response.type equals "success" and response.params.error differs from "access_denied"

      if (
        result.type === "success" &&
        result.params.error !== "access_denied"
      ) {
        if (result.params.state !== STATE) {
          throw new Error("Invalid state value");
        }
        api.defaults.headers.authorization = `Bearer ${result.params.access_token}`;

        const response = await api.get("/users");

        if (response.status === 200) {
          setUser(response.data.data[0]);

          setUserToken(result.params.access_token);

          setIsLoggingIn(false);
        }
      }
    } catch (error) {
      console.log(error);
      throw new Error();
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function signOut() {
    try {
      setIsLoggingOut(true);

      await revokeAsync(
        {
          token: userToken,
          clientId: CLIENT_ID,
        },
        {
          revocationEndpoint: twitchEndpoints.revocation,
        }
      );
    } catch (error) {
    } finally {
      setUser({} as User);

      setUserToken("");

      delete api.defaults.headers.authorization;

      setIsLoggingOut(false);
    }
  }

  useEffect(() => {
    api.defaults.headers["client-id"] = CLIENT_ID;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoggingOut, isLoggingIn, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);

  return context;
}

export { AuthProvider, useAuth };
