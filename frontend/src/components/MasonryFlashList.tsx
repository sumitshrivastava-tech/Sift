import React from 'react';
import { FlashList, FlashListProps } from '@shopify/flash-list';

const NUM_COLUMNS = 2;

/**
 * Performant MasonryFlashList Component using @shopify/flash-list
 * Eliminates scroll lag by leveraging recycled viewholders and native UI thread rendering.
 */
export const MasonryFlashList = React.forwardRef<any, FlashListProps<any>>((props, ref) => {
  return (
    <FlashList
      ref={ref}
      masonry={true}
      numColumns={NUM_COLUMNS}
      optimizeItemArrangement={true}
      {...props}
    />
  );
});

MasonryFlashList.displayName = 'MasonryFlashList';

