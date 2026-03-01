import React, { useCallback } from "react";
import { useDiffStore } from "../store/diffStore";
import styles from "./StaleBanner.module.css";

interface StaleBannerProps {
  onRefresh: () => void;
}

export const StaleBanner: React.FC<StaleBannerProps> = ({ onRefresh }) => {
  const { isStale, setIsStale } = useDiffStore();

  const handleRefresh = useCallback(() => {
    setIsStale(false);
    onRefresh();
  }, [onRefresh, setIsStale]);

  const handleDismiss = useCallback(() => {
    setIsStale(false);
  }, [setIsStale]);

  if (!isStale) return null;

  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>
        ファイルが変更されました。Diffを更新してください。
      </span>
      <button className={styles.refreshBtn} onClick={handleRefresh}>
        更新
      </button>
      <button
        className={styles.dismissBtn}
        onClick={handleDismiss}
        aria-label="閉じる"
      >
        &times;
      </button>
    </div>
  );
};
