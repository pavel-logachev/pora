import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';

export type PoraIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface PoraIconProps {
  color: string;
  name: PoraIconName;
  size?: number;
}

export function PoraIcon({ color, name, size = 20 }: PoraIconProps) {
  return (
    <MaterialCommunityIcons
      accessible={false}
      color={color}
      importantForAccessibility="no-hide-descendants"
      name={name}
      size={size}
    />
  );
}
