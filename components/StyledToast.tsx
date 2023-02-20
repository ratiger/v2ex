import Toast, {
  BaseToast,
  ErrorToast,
  SuccessToast,
  ToastConfig,
  ToastConfigParams,
} from 'react-native-toast-message'

import { getFontSize } from '@/jotai/fontSacleAtom'
import tw from '@/utils/tw'

const toastConfig: ToastConfig = {
  info: props => <BaseToast {...getToastProps(props)} />,
  success: props => <SuccessToast {...getToastProps(props)} />,
  error: props => <ErrorToast {...getToastProps(props)} />,
}

function getToastProps(props: ToastConfigParams<any>) {
  return {
    ...props,
    contentContainerStyle: tw`bg-body-2 overflow-hidden`,
    text1Style: tw.style(
      `${getFontSize(5)} text-tint-primary`,
      !props.text2 && `font-normal`
    ),
    text2Style: tw`${getFontSize(6)}`,
    topOffset: 55,
  }
}

export default function StyledToast() {
  return <Toast config={toastConfig} />
}
