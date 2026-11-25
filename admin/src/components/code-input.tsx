"use client";

import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";

interface CodeInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}

/** Six boxes for a one-time code. Accepts paste. */
export function CodeInput({ id, value, onChange, onComplete, disabled, invalid }: CodeInputProps) {
  return (
    <InputOTP
      id={id}
      maxLength={6}
      inputMode="numeric"
      pattern="^[0-9]*$"
      autoComplete="one-time-code"
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      aria-invalid={invalid}
      containerClassName="code-input"
    >
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  );
}
