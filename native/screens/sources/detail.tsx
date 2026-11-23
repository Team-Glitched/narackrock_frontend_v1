import { Text, View } from "react-native";
import type { NativeSourceDetail } from "../../../src/lib/native-screens";
import { Cover } from "../../ui/cards";
import { Comments } from "../../ui/comments";
import { AppHeader } from "../../ui/header";
import { ErrorRetry, Status } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors, type } from "../../ui/theme";
import { Pill } from "../workspace/parts";
import type { ScreenProps } from "../types";
import { SourceActions, SourceAuthor, SourceLogin, SourcePlayer, styles } from "./parts";

export function SourceDetailScreen({ model, header }: ScreenProps<"source-detail">) {
  const { act } = useScreen();
  return (
    <>
      {header && <AppHeader header={header} />}
      {model.state === "invalid" ? (
        <Status tone="error">올바르지 않은 페이지 주소입니다.</Status>
      ) : model.state === "signed-out" ? (
        <SourceLogin>샘플은 로그인 후 볼 수 있습니다.</SourceLogin>
      ) : model.state === "loading" ? (
        <Status>샘플을 불러오는 중...</Status>
      ) : model.state === "error" ? (
        <ErrorRetry message={model.message} onRetry={() => act({ type: "source-retry" })} />
      ) : model.state === "ready" ? (
        <Comments comments={model.comments} header={<Article model={model} />} />
      ) : null}
    </>
  );
}

function Article({ model }: { model: Extract<NativeSourceDetail, { state: "ready" }> }) {
  const { act } = useScreen();
  const { source } = model;
  return (
    <View style={{ borderBottomWidth: 8, borderBottomColor: colors.panel }}>
      <View style={styles.column}>
        <View style={styles.row}>
          <Cover url={source.thumbnailUrl} size={44} />
          <View style={styles.title}>
            <Text style={type.title}>{source.title}</Text>
            {source.usage && <Text style={type.caption}>{source.usage}</Text>}
          </View>
          <Pill
            primary
            label={source.saved ? "저장됨" : "저장"}
            pressed={source.saved}
            disabled={model.saveBusy}
            onPress={() => act({ type: "source-save" })}
          />
        </View>
        {model.saveError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {model.saveError}
          </Text>
        )}
        <SourceAuthor
          writer={source.writer}
          onPress={() => act({ type: "source-profile", userId: source.writer.userId })}
        />
        {source.instrumentLabel && <Text style={styles.copy}>악기: {source.instrumentLabel}</Text>}
        <Text style={styles.copy}>{source.description}</Text>
        <SourcePlayer
          player={model.player}
          canPreview={source.canPreview}
          durationHint
          onToggle={() => act({ type: "source-play" })}
          onSeek={(ms) => act({ type: "source-seek", ms })}
          onMute={() => act({ type: "source-mute" })}
        />
        <Text style={type.caption}>
          보관한 뒤 피아노롤의 ‘+ 샘플’에서 내 레이어에 오디오로 넣을 수 있습니다.
        </Text>
        <SourceActions
          source={source}
          busy={model.busy}
          onVote={(vote) => act({ type: "source-vote", vote })}
          onComments={() => act({ type: "source-comments" })}
          onSave={() => act({ type: "source-save" })}
          onShare={() => act({ type: "source-share" })}
          onReport={
            model.canReport
              ? () => act({ type: "report", kind: "source", id: source.openSourceId, title: source.title })
              : undefined
          }
        />
        {model.notice && (
          <Text accessibilityLiveRegion="polite" style={type.body}>
            {model.notice}
          </Text>
        )}
      </View>
    </View>
  );
}
