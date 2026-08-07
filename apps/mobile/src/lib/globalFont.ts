import { Text, TextInput } from 'react-native';
import { FONT_FAMILY } from '../constants/theme';

/**
 * Aplica a Montserrat (mesma fonte do app web) como padrão em todo
 * <Text>/<TextInput> sem precisar tocar em cada StyleSheet individualmente.
 */
const TextAny = Text as unknown as { defaultProps?: { style?: unknown } };
TextAny.defaultProps = TextAny.defaultProps ?? {};
TextAny.defaultProps.style = [{ fontFamily: FONT_FAMILY.regular }, TextAny.defaultProps.style];

const TextInputAny = TextInput as unknown as { defaultProps?: { style?: unknown } };
TextInputAny.defaultProps = TextInputAny.defaultProps ?? {};
TextInputAny.defaultProps.style = [{ fontFamily: FONT_FAMILY.regular }, TextInputAny.defaultProps.style];
