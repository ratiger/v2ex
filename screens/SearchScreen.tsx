import { RouteProp, useRoute } from '@react-navigation/native'
import dayjs from 'dayjs'
import { useAtomValue } from 'jotai'
import {
  compact,
  isEmpty,
  isEqual,
  isString,
  maxBy,
  uniqBy,
  upperCase,
} from 'lodash-es'
import { useCallback, useMemo, useState } from 'react'
import { memo } from 'react'
import {
  FlatList,
  ListRenderItem,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import WebView from 'react-native-webview'

import DebouncedPressable from '@/components/DebouncedPressable'
import Empty from '@/components/Empty'
import Html from '@/components/Html'
import IconButton from '@/components/IconButton'
import LoadingIndicator from '@/components/LoadingIndicator'
import NavBar, { NAV_BAR_HEIGHT, useNavBarHeight } from '@/components/NavBar'
import NodeItem from '@/components/NodeItem'
import { FallbackComponent, QuerySuspense } from '@/components/QuerySuspense'
import SearchBar from '@/components/SearchBar'
import Separator, { LineSeparator } from '@/components/Separator'
import StyledActivityIndicator from '@/components/StyledActivityIndicator'
import StyledBlurView from '@/components/StyledBlurView'
import StyledButton from '@/components/StyledButton'
import StyledRefreshControl from '@/components/StyledRefreshControl'
import TopicPlaceholder from '@/components/placeholder/TopicPlaceholder'
import { sov2exArgsAtom } from '@/jotai/sov2exArgsAtom'
import { colorSchemeAtom } from '@/jotai/themeAtom'
import { uiAtom } from '@/jotai/uiAtom'
import { navigation } from '@/navigation/navigationRef'
import { Member, Node, Sov2exResult, k } from '@/servicies'
import { RootStackParamList } from '@/types'
import tw from '@/utils/tw'
import { useRefreshByUser } from '@/utils/useRefreshByUser'

export default function SearchScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'Search'>>()

  const [searchText, setSearchText] = useState(params?.query || '')

  const trimedSearchText = searchText.trim()

  const [isSearchNode, setIsSearchNode] = useState(!params?.query)

  const { data: matchNodes } = k.node.all.useQuery({
    select: useCallback(
      (nodes: Node[]) => {
        if (!isSearchNode) return []
        return nodes.filter(node =>
          [
            node.title,
            node.title_alternative,
            node.name,
            ...(node.aliases || []),
          ].some(
            text =>
              isString(text) &&
              upperCase(text).includes(upperCase(trimedSearchText))
          )
        )
      },
      [isSearchNode, trimedSearchText]
    ),
  })

  const handleClickNode = useCallback((node: Node) => {
    navigation.navigate('NodeTopics', { name: node.name })
  }, [])

  const renderNodeItem: ListRenderItem<Node> = useCallback(
    ({ item }) => (
      <NodeItem
        key={`${item.title}_${item.name}`}
        node={item}
        onPressNodeItem={handleClickNode}
      />
    ),
    [handleClickNode]
  )

  const colorScheme = useAtomValue(colorSchemeAtom)

  const navbarHeight = useNavBarHeight()

  const sov2exArgs = useAtomValue(sov2exArgsAtom)

  const isGoogleSearch = sov2exArgs.source === 'google'

  const { colors, fontSize } = useAtomValue(uiAtom)

  return (
    <View style={tw`flex-1 bg-[${colors.base100}]`}>
      {isSearchNode ? (
        <FlatList
          key={colorScheme}
          contentContainerStyle={{
            paddingTop: navbarHeight,
          }}
          ListHeaderComponent={
            <View>
              {!!trimedSearchText && (
                <TouchableOpacity
                  style={tw`px-4 py-2.5`}
                  onPress={() => {
                    setIsSearchNode(!trimedSearchText)
                  }}
                >
                  <Text
                    style={tw`text-[${colors.foreground}] ${fontSize.medium}`}
                  >
                    {isGoogleSearch ? 'Google' : 'SOV2EX'}:{' '}
                    <Text style={tw`text-[${colors.foreground}]`}>
                      “{trimedSearchText}”
                    </Text>
                  </Text>
                </TouchableOpacity>
              )}
              {!isEmpty(matchNodes) && (
                <View
                  style={tw.style(
                    `px-4 pt-2.5 pb-2`,
                    !!trimedSearchText &&
                      `border-[${colors.divider}] border-t border-solid`
                  )}
                >
                  <Text style={tw`text-[${colors.default}] ${fontSize.medium}`}>
                    节点
                  </Text>
                </View>
              )}
            </View>
          }
          ListFooterComponent={<SafeAreaView edges={['bottom']} />}
          data={matchNodes}
          renderItem={renderNodeItem}
          getItemLayout={(_, index) => ({
            length: NAV_BAR_HEIGHT,
            offset: index * NAV_BAR_HEIGHT,
            index,
          })}
        />
      ) : (
        <QuerySuspense
          loading={
            <TopicPlaceholder hideAvatar style={{ paddingTop: navbarHeight }} />
          }
          fallbackRender={fallbackProps => (
            <View style={{ paddingTop: navbarHeight }}>
              <FallbackComponent {...fallbackProps} />
            </View>
          )}
        >
          {isGoogleSearch ? (
            <GoogleSearch
              query={trimedSearchText}
              navbarHeight={navbarHeight}
            />
          ) : (
            <SoV2exList
              key={colorScheme}
              query={trimedSearchText}
              navbarHeight={navbarHeight}
            />
          )}
        </QuerySuspense>
      )}

      <View style={tw`absolute top-0 inset-x-0 z-10`}>
        <StyledBlurView style={tw`absolute inset-0`} />
        <NavBar
          right={
            <IconButton
              name="filter-outline"
              size={24}
              color={colors.foreground}
              activeColor={colors.foreground}
              onPress={() => {
                navigation.navigate('SearchOptions')
              }}
            />
          }
          style={tw.style(
            isGoogleSearch &&
              !isSearchNode &&
              `border-[${colors.divider}] border-solid border-b`
          )}
        >
          <SearchBar
            style={tw`flex-1`}
            value={searchText}
            onChangeText={text => {
              if (text !== searchText) {
                setIsSearchNode(true)
                setSearchText(text)
              }
            }}
            onSubmitEditing={() => {
              setIsSearchNode(!searchText)
            }}
            autoFocus
          />
        </NavBar>
      </View>
    </View>
  )
}

function SoV2exList({
  navbarHeight,
  query,
}: {
  navbarHeight: number
  query: string
}) {
  const sov2exArgs = useAtomValue(sov2exArgsAtom)

  const { data, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    k.other.sov2ex.useSuspenseInfiniteQuery({
      variables: { ...sov2exArgs, q: query },
    })

  const { data: nodeMap } = k.node.all.useQuery({
    select: useCallback(
      (nodes: Node[]) => Object.fromEntries(nodes.map(node => [node.id, node])),
      []
    ),
  })

  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(refetch)

  const renderItem: ListRenderItem<Sov2exResult['hits'][number]> = useCallback(
    ({ item }) => (
      <HitItem
        topic={{
          node: nodeMap?.[item._source.node],
          member: {
            username: item._source.member,
          },
          id: item._source.id,
          title: item._source.title,
          reply_count: item._source.replies,
          created: item._source.created.toString(),
          content: item.highlight?.content?.[0],
        }}
      />
    ),
    [nodeMap]
  )

  const flatedData = useMemo(
    () => uniqBy(data.pages.map(page => page.hits).flat(), '_id'),
    [data.pages]
  )

  const { colors, fontSize } = useAtomValue(uiAtom)

  return (
    <FlatList
      data={flatedData}
      ListHeaderComponent={
        !isEmpty(flatedData) ? (
          <View style={tw`px-4 py-2.5`}>
            <Text style={tw`text-[${colors.foreground}] ${fontSize.medium}`}>
              以下搜索结果来自于{' '}
              <Text
                style={tw`text-[${colors.primary}]`}
                onPress={() => {
                  navigation.navigate('Webview', {
                    url: `https://www.sov2ex.com`,
                  })
                }}
              >
                SOV2EX
              </Text>
            </Text>
          </View>
        ) : null
      }
      refreshControl={
        <StyledRefreshControl
          refreshing={isRefetchingByUser}
          onRefresh={refetchByUser}
          progressViewOffset={navbarHeight}
        />
      }
      contentContainerStyle={{
        paddingTop: navbarHeight,
      }}
      ItemSeparatorComponent={LineSeparator}
      renderItem={renderItem}
      onEndReached={() => {
        if (hasNextPage) {
          fetchNextPage()
        }
      }}
      onEndReachedThreshold={0.3}
      ListFooterComponent={
        <SafeAreaView edges={['bottom']}>
          {isFetchingNextPage ? (
            <StyledActivityIndicator style={tw`py-4`} />
          ) : null}
        </SafeAreaView>
      }
      ListEmptyComponent={<Empty description="暂无搜索结果" />}
    />
  )
}

const HitItem = memo(
  ({
    topic,
  }: {
    topic: {
      node: Node
      member: Member
      id: number
      title: string
      reply_count: number
      created: string
      content: string
    }
  }) => {
    const { data: isReaded } = k.topic.detail.useInfiniteQuery({
      variables: { id: topic.id },
      select: data => {
        const replyCount = maxBy(data.pages, 'reply_count')?.reply_count || 0
        return replyCount >= topic.reply_count
      },
      enabled: false,
    })
    const { colors, fontSize } = useAtomValue(uiAtom)

    return (
      <DebouncedPressable
        style={tw`px-4 py-3 flex-row bg-[${colors.base100}]`}
        onPress={() => {
          navigation.push('TopicDetail', topic)
        }}
      >
        <View style={tw`flex-1`}>
          <View style={tw`flex-row gap-2`}>
            {!!topic.node?.title && (
              <StyledButton
                size="mini"
                type="tag"
                onPress={() => {
                  navigation.push('NodeTopics', {
                    name: topic.node?.name!,
                  })
                }}
              >
                {topic.node?.title}
              </StyledButton>
            )}
            <Text
              style={tw`text-[${colors.foreground}] ${fontSize.medium} font-semibold flex-shrink`}
              numberOfLines={1}
              onPress={() => {
                navigation.push('MemberDetail', {
                  username: topic.member?.username!,
                })
              }}
            >
              {topic.member?.username}
            </Text>

            <Separator>
              {compact([
                <Text
                  key="created"
                  style={tw`text-[${colors.default}] ${fontSize.medium}`}
                >
                  {dayjs(topic.created).fromNow()}
                </Text>,
                !!topic.reply_count && (
                  <Text
                    key="replies"
                    style={tw`text-[${colors.default}] ${fontSize.medium}`}
                  >
                    {`${topic.reply_count} 回复`}
                  </Text>
                ),
              ])}
            </Separator>
          </View>

          <Text
            style={tw.style(
              `${fontSize.medium} font-medium pt-2`,
              isReaded
                ? `text-[${colors.default}]`
                : `text-[${colors.foreground}]`
            )}
          >
            {topic.title}
          </Text>

          {!!topic.content && (
            <View style={tw`pt-2`}>
              <Html
                source={{
                  html: topic.content,
                }}
                baseStyle={tw.style(
                  `${fontSize.medium}`,
                  isReaded
                    ? `text-[${colors.default}]`
                    : `text-[${colors.foreground}]`
                )}
                defaultTextProps={{ selectable: false }}
              />
            </View>
          )}
        </View>
      </DebouncedPressable>
    )
  },
  isEqual
)

const getTopicLink = `(function() {
  try {
    document.body.addEventListener('click', function(e) {
      const a = e.target.closest('a');

      if (a && /^https:\\/\\/(\\\w+\\.)?v2ex\\.com\\/t/.test(a.href)) {
        e.preventDefault();
        e.stopPropagation();
        window.ReactNativeWebView.postMessage(a.href)
      }
    }, {
        capture: true
    });
  } catch (err) {
  }
}())`

function GoogleSearch({
  navbarHeight,
  query,
}: {
  navbarHeight: number
  query: string
}) {
  const { colors } = useAtomValue(uiAtom)

  return (
    <WebView
      injectedJavaScript={getTopicLink}
      style={tw.style(`flex-1`, {
        marginTop: navbarHeight,
      })}
      source={{
        uri: `https://google.com/search?q=${encodeURIComponent(
          'site:v2ex.com/t ' + query
        )}`,
      }}
      onMessage={event => {
        const link = event.nativeEvent.data
        const [, id] =
          link.slice(link.indexOf('com') + 3).match(/\/\w+\/(\w+)/) || []

        if (id) {
          navigation.push('TopicDetail', {
            id: parseInt(id, 10),
          })
        }
      }}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      decelerationRate="normal"
      sharedCookiesEnabled={true}
      startInLoadingState={true}
      scalesPageToFit={true}
      renderLoading={() => (
        <LoadingIndicator
          style={tw.style(`absolute w-full h-full bg-[${colors.base100}]`, {
            paddingTop: navbarHeight,
          })}
        />
      )}
    />
  )
}
