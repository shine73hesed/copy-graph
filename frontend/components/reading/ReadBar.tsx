'use client';

interface Props {
  width: number; // 0~100
}

export default function ReadBar({ width }: Props) {
  return <div className="read-bar" style={{ width: `${Math.min(100, width)}%` }} />;
}
