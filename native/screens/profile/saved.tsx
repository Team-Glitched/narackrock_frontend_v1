import { Image, StyleSheet, Text, View } from "react-native";

import OptionIcon from "../../../public/figma/option.svg";
import type { NativeSavedItem } from "../../../src/lib/native-screens";
import { Cover } from "../../ui/cards";
import { AppHeader } from "../../ui/header";
import { Avatar, Button, Touchable } from "../../ui/kit";
import { ScreenList } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { CenterMessage, FilterChip, Notice, styles as partStyles } from "./parts";

/** The web saved page (src/features/saved/saved-screen.tsx). */
export function SavedScreen({ model, header }: ScreenProps<"profile-saved">) {
  const { act } = useScreen();
  if (model.status === "signed-out")
    return (
      <>
        {header && <AppHeader header={header} />}
        <CenterMessage action={<Button label="로그인" onPress={() => act({ type: "sign-in" })} />}>
          저장한 콘텐츠는 로그인 후 볼 수 있습니다.
        </CenterMessage>
      </>
    );
  const listError = model.listError;
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenList
        data={model.items}
        keyExtractor={(item) => String(item.id)}
        hasMore={model.more}
        busy={model.listBusy || model.busy}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.top}>
            <Text style={[type.title, styles.padded]} accessibilityRole="header">
              저장한 콘텐츠
            </Text>
            <View style={[partStyles.chipRow, styles.padded]} accessibilityLabel="저장 목록 종류">
              <FilterChip
                label="게시글"
                pressed={model.kind === "post"}
                onPress={() => act({ type: "kind", kind: "post" })}
              />
              <FilterChip
                label="어비스"
                pressed={model.kind === "song"}
                onPress={() => act({ type: "kind", kind: "song" })}
              />
            </View>
            {model.error && <Notice tone="error">{model.error}</Notice>}
            {model.status === "loading" && (
              <CenterMessage>저장 목록을 불러오는 중...</CenterMessage>
            )}
            {model.empty && (
              <CenterMessage>
                {`저장한 ${model.kind === "post" ? "게시글이" : "어비스가"} 없습니다.\n마음에 드는 콘텐츠의 저장 버튼을 눌러보세요.`}
              </CenterMessage>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <SavedRow
            item={item}
            kind={model.kind}
            menuOpen={model.menu === item.id}
            disabled={model.busy || model.listBusy}
          />
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            {listError && (
              <CenterMessage
                tone="error"
                action={
                  listError.retry ? (
                    <Button
                      label={model.listBusy ? "불러오는 중..." : "다시 시도"}
                      tone="secondary"
                      disabled={model.listBusy || model.busy}
                      style={styles.pill}
                      onPress={() => act({ type: "more" })}
                    />
                  ) : undefined
                }
              >
                {listError.message}
              </CenterMessage>
            )}
            {model.more && (
              <Button
                label={model.listBusy ? "불러오는 중..." : "더보기"}
                tone="secondary"
                disabled={model.listBusy || model.busy}
                style={[styles.pill, styles.padded]}
                onPress={() => act({ type: "more" })}
              />
            )}
            <Text style={[styles.caption, styles.padded]}>내 계정에 저장한 콘텐츠입니다.</Text>
          </View>
        }
      />
    </>
  );
}

function SavedRow({
  item,
  kind,
  menuOpen,
  disabled,
}: {
  item: NativeSavedItem;
  kind: "post" | "song";
  menuOpen: boolean;
  disabled: boolean;
}) {
  const { act, uri } = useScreen();
  const image = uri(item.imageUrl);
  return (
    <View style={styles.rowWrap}>
      <View style={styles.row}>
        <Touchable
          accessibilityRole="button"
          style={styles.rowMain}
          onPress={() => act({ type: "open", id: item.id })}
        >
          {kind === "song" ? (
            <Cover url={item.imageUrl} size={64} />
          ) : (
            <View style={styles.thumb}>
              {image && <Image source={{ uri: image }} style={StyleSheet.absoluteFill} />}
            </View>
          )}
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            {kind === "post" ? (
              <View style={styles.author}>
                <Avatar uri={null} size={16} />
                <Text style={[type.muted, styles.flex]} numberOfLines={1}>
                  {item.author}
                </Text>
              </View>
            ) : (
              <Text style={type.muted} numberOfLines={1}>
                {item.author}
              </Text>
            )}
          </View>
        </Touchable>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`${item.title} 저장 옵션`}
          accessibilityState={{ expanded: menuOpen }}
          hitSlop={6}
          style={styles.option}
          onPress={() => act({ type: "menu", id: item.id })}
        >
          <OptionIcon width={20} height={20} />
        </Touchable>
      </View>
      {menuOpen && (
        <View style={styles.menu}>
          <Touchable
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            style={[styles.menuItem, disabled && partStyles.disabled]}
            onPress={() => act({ type: "unsave", id: item.id })}
          >
            <Text style={type.body}>저장 해제</Text>
          </Touchable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: 16 },
  top: { gap: 20, marginBottom: 4 },
  padded: { marginHorizontal: gutter },
  footer: { gap: 20, marginTop: 4 },
  pill: { borderRadius: 999 },
  caption: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 8 },
  rowWrap: { paddingHorizontal: gutter },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  copy: { flex: 1, gap: 4 },
  title: { color: colors.fg, fontSize: 16, lineHeight: 22, fontWeight: "600" },
  author: { flexDirection: "row", alignItems: "center", gap: 6 },
  option: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  menu: {
    alignSelf: "flex-end",
    borderRadius: 8,
    backgroundColor: colors.surface,
    elevation: 4,
  },
  menuItem: { paddingHorizontal: 20, paddingVertical: 12 },
});
