const getLoginByCodeHeader = (appKey: string) => ({
  appKey,
  parentScope: 2,
  scope: 7,
});

const urlMap = {
  getLoginSmsCode: "/userCenter/v1/auth/sendLoginSmsCode",
  loginRegisterByCode: "/userCenter/v1/auth/loginRegisterByCode",
  loginRegisterByToken: "/userCenter/v1/auth/loginByToken",
  logout: "/userCenter/v1/auth/logout",
};
type LoginSmsCodeRes = {
  isFirstRegister: boolean;
};
export const getLoginSmsCode = ({
  appKey,
  baseUrl,
  mobile,
}: {
  appKey: string;
  baseUrl: string;
  mobile: string;
}): Promise<LoginSmsCodeRes> => {
  const url = baseUrl + urlMap.getLoginSmsCode;

  return fetch(url, {
    method: "POST",
    //@ts-ignore
    headers: {
      "Content-Type": "application/json",
      ...getLoginByCodeHeader(appKey),
    },
    body: JSON.stringify({ mobile }),
  }).then(async (response) => {
    const responseData = await response.json();
    if (responseData.code !== 200) {
      throw responseData;
    }
    return responseData.data as LoginSmsCodeRes;
  });
};

export const loginRegisterByCode = ({
  appKey,
  baseUrl,
  mobile,
  smsCode,
}: {
  appKey: string;
  mobile: string;
  smsCode: string;
  baseUrl: string;
}): Promise<LoginRegisterByCodeRes> => {
  const url = baseUrl + urlMap.loginRegisterByCode;

  return fetch(url, {
    method: "POST",
    //@ts-ignore
    headers: {
      "Content-Type": "application/json",
      ...getLoginByCodeHeader(appKey),
    },
    body: JSON.stringify({ mobile, smsCode }),
  }).then(async (response) => {
    const responseData = await response.json();
    if (responseData.code !== 200) {
      throw responseData;
    }
    return responseData.data as LoginRegisterByCodeRes;
  });
};

type LoginRegisterByCodeRes = {
  accessToken: string;
  imAccid: string;
  imToken: string;
};
