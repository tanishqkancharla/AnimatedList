import React, {
	ReactElement,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react"
import { Animated, LayoutRectangle, View, useAnimatedValue } from "react-native"

export function useStableCallback<I extends any[], O>(
	fn: (...args: I) => O,
): (...args: I) => O {
	const fnRef = useRef(fn)
	fnRef.current = fn

	return useCallback((...args: I) => fnRef.current?.(...args), [])
}

type AnimatePresenceProps = {
	children: React.ReactNode
	height: number
}

export const AnimatePresence: React.FC<AnimatePresenceProps> = ({
	children,
	height,
}) => {
	const incomingChildren = React.Children.toArray(children).filter(
		(child): child is ReactElement => {
			const isValid = React.isValidElement(child)

			if (!isValid) {
				console.warn(
					`AnimatePresence: child is not a valid React element. It will be filtered out:\n${child}`,
					child,
				)
			}

			return isValid
		},
	)

	const [currentChildren, setCurrentChildren] = useState(incomingChildren)
	const childrenToRender = [...incomingChildren]

	// Splice in the exiting children
	for (let index = 0; index < currentChildren.length; index++) {
		const currentChild = currentChildren[index]
		const isExiting =
			incomingChildren.findIndex(({ key }) => key === currentChild.key) < 0

		if (isExiting) {
			childrenToRender.splice(index, 0, currentChild)
		}
	}

	// Render all the children, with the exiting children marked as exiting
	return (
		<View>
			{childrenToRender.map((child) => {
				const index = incomingChildren.findIndex(({ key }) => key === child.key)

				return (
					<PresenceChild
						key={child.key}
						index={index}
						height={height}
						onExitComplete={() => {
							setCurrentChildren(
								childrenToRender.filter(({ key }) => key !== child.key),
							)
						}}
					>
						{child}
					</PresenceChild>
				)
			})}
		</View>
	)
}

type PresenceChildProps = {
	index: number
	height: number
	onExitComplete: () => void
	children: React.ReactNode
}

const PresenceChild: React.FC<PresenceChildProps> = ({
	index,
	height,
	onExitComplete,
	children,
}) => {
	const prevIndexRef = useRef(-1)

	const [layout, setLayout] = useState<LayoutRectangle | undefined>(undefined)

	const isEntering = index !== -1 && prevIndexRef.current === -1
	const isExiting = index === -1 && prevIndexRef.current !== -1

	const stableOnExitComplete = useStableCallback(onExitComplete)
	const translateY = useAnimatedValue(0)

	const zIndex = isEntering || isExiting ? 0 : 1

	useEffect(() => {
		if (!layout) return
		if (isExiting) {
			Animated.spring(translateY, {
				toValue: -layout.height,
				damping: 30,
				stiffness: 270,
				useNativeDriver: true,
			}).start(stableOnExitComplete)
		} else if (isEntering) {
			Animated.spring(translateY, {
				toValue: 0,
				damping: 30,
				stiffness: 270,
				useNativeDriver: true,
			}).start()
		} else if (index !== prevIndexRef.current) {
			translateY.setValue((prevIndexRef.current - index) * height)
			Animated.spring(translateY, {
				toValue: 0,
				damping: 30,
				stiffness: 270,
				useNativeDriver: true,
			}).start()
		}
	}, [
		height,
		index,
		isEntering,
		isExiting,
		layout,
		stableOnExitComplete,
		translateY,
	])

	useEffect(() => {
		if (layout) prevIndexRef.current = index
	}, [index, layout])

	return (
		<View
			style={[
				{ zIndex },
				isExiting && {
					position: "absolute",
					top: layout?.y,
					left: layout?.x,
					width: layout?.width,
					height: layout?.height,
				},
			]}
			onLayout={({ nativeEvent }) => {
				const { layout } = nativeEvent
				setLayout(layout)
				if (isEntering) translateY.setValue(-layout.height)
			}}
		>
			<Animated.View
				style={[
					{ transform: [{ translateY }] },
					isEntering && !layout && { position: "relative", top: "-100%" },
				]}
			>
				{children}
			</Animated.View>
		</View>
	)
}
